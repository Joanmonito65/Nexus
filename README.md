# NEXUS Browser

NEXUS Browser is a static, local-first workspace. It has no NEXUS server, account, telemetry, or cloud data API. Workspace records are stored in IndexedDB. Uploaded file contents use the browser's Origin Private File System when available and fall back to IndexedDB. This build does not bundle SQLite compiled to WebAssembly; IndexedDB is the main record store.

## Run it

Serve this folder from a local static server. For example, with Python installed on Windows, open PowerShell in this folder and run:

```powershell
py -m http.server 4173 --bind 127.0.0.1
```

Then open `http://127.0.0.1:4173`. The local server only delivers the app files. The service worker caches the app shell for offline use after the first load. The browser must support IndexedDB; OPFS and installable PWA behavior depend on browser support.

You can also host these static files on a server you control. That host can see normal web requests for the app files, but NEXUS does not send workspace records or uploaded content to it.

## Back up your workspace

Open **Settings → Import & export → Export all data** regularly. The `.nexus.zip` archive contains workspace records, uploaded file contents, a versioned manifest, and integrity checks. It excludes authentication secrets. Import previews the archive and merges it into the current workspace. If your browser supports the File System Access API, you can grant a folder for the current session; otherwise the backup downloads normally.

Clearing this site's browser data may erase the workspace. Persistent storage is requested through Settings, but the browser controls whether it grants that request and the user can still clear site data.

## What this browser edition supports

- Files and folders, local previews for images, PDFs, and common text formats, downloads, favorites, and Trash.
- Local documents with basic rich text, text and HTML export; simple cell grids with basic aggregate formulas and CSV export; text slide decks with JSON export.
- Notes, bookmarks, collections, local search, multiple calendars, all-day events, recurring daily/weekday/weekly/biweekly/monthly/yearly dates, task lists, and open-tab reminders.
- Portable NEXUS workspace ZIP export/import.
- Archive construction, parsing, and hashing run in a Web Worker.

## Browser limits

- NEXUS cannot open the browser's managed storage folder in the file explorer or read arbitrary computer folders. Users pick files to upload and may grant a backup folder in supported browsers.
- Reminders only run while NEXUS is open. Browser timers and notifications are not guaranteed after the tab or installed app is closed.
- This standalone build has no Gmail or Outlook OAuth connector. Proton Mail Bridge, Yahoo, and generic IMAP/SMTP are unavailable in a browser edition.
- DOCX/PDF document conversion, XLSX/ODS spreadsheets, PPTX/PDF presentation export, calendar synchronization, and a full per-event timezone editor are not bundled. Unsupported formats can still be stored and downloaded as files.
- Calendar recurrence edits apply to the series; per-occurrence exceptions and “this and future” edits are not implemented. Task subtasks, repeating tasks, ICS/CSV calendar interchange, EML/MBOX parsing, and selective exports are also not included yet.

No browser application can guarantee recovery after its site data is cleared. Keep a portable backup outside the browser.
