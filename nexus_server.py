#!/usr/bin/env python3
"""Loopback-only NEXUS static server with an optional NTP time check."""
from __future__ import annotations

import json
import socket
import struct
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
HOST = "127.0.0.1"
PORT = 4173
NTP_EPOCH = 2_208_988_800
NIST_HOST = "time.nist.gov"
FALLBACK_HOST = "time.cloudflare.com"
NIST_MIN_INTERVAL = 4.1
_cache_lock = threading.Lock()
_last_nist_request = 0.0
_cached: dict | None = None
_cached_at = 0.0


def ntp_seconds(stamp: bytes) -> float:
    seconds, fraction = struct.unpack("!II", stamp)
    return seconds - NTP_EPOCH + fraction / 4_294_967_296


def query_ntp(host: str, timeout: float = 2.5) -> dict:
    packet = bytearray(48)
    packet[0] = 0x23  # NTP v4 client request
    t0_wall = time.time()
    t0_mono = time.monotonic()
    seconds = int(t0_wall + NTP_EPOCH)
    fraction = int((t0_wall + NTP_EPOCH - seconds) * 4_294_967_296)
    struct.pack_into("!II", packet, 40, seconds, fraction)
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as client:
        client.settimeout(timeout)
        client.sendto(packet, (host, 123))
        response, _ = client.recvfrom(512)
    t4_mono = time.monotonic()
    t4_wall = t0_wall + (t4_mono - t0_mono)
    if len(response) < 48:
        raise OSError("The NTP reply was incomplete.")
    leap = response[0] >> 6
    mode = response[0] & 0x07
    stratum = response[1]
    if leap == 3 or mode != 4 or stratum == 0:
        raise OSError("The NTP server returned an unsynchronized response.")
    t2 = ntp_seconds(response[32:40])
    t3 = ntp_seconds(response[40:48])
    offset_ms = ((t2 - t0_wall) + (t3 - t4_wall)) * 500
    rtt_ms = max(0.0, (t4_mono - t0_mono) * 1000)
    if abs(offset_ms) > 86_400_000:
        raise OSError("The NTP reply was outside the accepted time range.")
    return {"source": "NIST Internet Time Service (UTC(NIST))" if host == NIST_HOST else "Cloudflare NTP fallback", "server": host, "offsetMs": offset_ms, "rttMs": rtt_ms, "sampledAt": int(t4_wall * 1000)}


def get_network_time() -> dict:
    global _last_nist_request, _cached, _cached_at
    now = time.monotonic()
    with _cache_lock:
        if _cached is not None and now - _cached_at < 20:
            return {**_cached, "sampleAgeMs": int((now - _cached_at) * 1000)}
        rate_limited = now - _last_nist_request < NIST_MIN_INTERVAL
        if not rate_limited:
            _last_nist_request = now
    errors: list[str] = []
    if not rate_limited:
        try:
            result = query_ntp(NIST_HOST)
            with _cache_lock:
                _cached, _cached_at = result, time.monotonic()
            return result
        except OSError as error:
            errors.append(f"NIST: {error}")
    try:
        result = query_ntp(FALLBACK_HOST)
        result["fallbackReason"] = "; ".join(errors) if errors else "NIST is rate-limited; using the cached/backup path."
        with _cache_lock:
            _cached, _cached_at = result, time.monotonic()
        return result
    except OSError as error:
        errors.append(f"Cloudflare: {error}")
        raise OSError("No NTP source responded. " + "; ".join(errors)) from error


class NexusHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        super().end_headers()

    def do_OPTIONS(self):
        if urlsplit(self.path).path != "/api/time":
            self.send_error(404)
            return
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Access-Control-Max-Age", "600")
        self.end_headers()

    def do_GET(self):
        if urlsplit(self.path).path == "/api/time":
            try:
                payload = json.dumps(get_network_time(), separators=(",", ":")).encode("utf-8")
            except OSError as error:
                payload = json.dumps({"error": str(error)}, separators=(",", ":")).encode("utf-8")
                self.send_response(503)
            else:
                self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Private-Network", "true")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return
        self.path = urlsplit(self.path)._replace(query="", fragment="").geturl()
        super().do_GET()

    def do_POST(self):
        self.send_error(405, "NEXUS local server does not accept uploads.")

    def log_message(self, format, *args):
        # Keep ordinary workspace browsing quiet; log only endpoint failures.
        if self.path.startswith("/api/time") and args and str(args[1]).startswith(("5", "4")):
            super().log_message(format, *args)


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), NexusHandler)
    print(f"NEXUS is available at http://{HOST}:{PORT}")
    print("This static server binds only to this computer. It accepts no uploads and stores no network-time data.")
    print("Optional automatic time sync requests NIST UTC(NIST) via NTP, with Cloudflare NTP as fallback.")
    print("Press Ctrl+C to stop the server.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Stopping NEXUS local server.")
    finally:
        server.server_close()
