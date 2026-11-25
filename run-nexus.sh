#!/bin/sh
set -eu
cd "$(dirname "$0")"

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is required to run the local NEXUS server." >&2
  exit 1
fi

echo "When the server is running, open http://127.0.0.1:4173 in your browser."
echo "This server listens only on this computer. Press Ctrl+C to stop it."
exec python3 -m http.server 4173 --bind 127.0.0.1
