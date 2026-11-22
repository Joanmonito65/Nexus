# NEXUS Browser

NEXUS Browser is a static, local-first workspace. It has no NEXUS server, account, telemetry, or cloud data API. Workspace records are stored in IndexedDB. Uploaded file contents use the browser's Origin Private File System when available and fall back to IndexedDB. This build does not bundle SQLite compiled to WebAssembly; IndexedDB is the main record store.

## Run it

Serve this folder from a local static server. For example, with Python installed on Windows, open PowerShell in this folder and run:

```powershell
py -m http.server 4173 --bind 127.0.0.1
```

Then open `http://127.0.0.1:4173`. The local server only delivers the app files. The service worker caches the app shell for offline use after the first load. The browser must support IndexedDB; OPFS and installable PWA behavior depend on browser support.

You can also host these static files on a server you control. That host can see normal web requests for the app files, but NEXUS does not send workspace records or uploaded content to it.

## Workspaces and backups

Open **Settings → Workspaces** to create, switch, rename, duplicate, archive, restore, export, import, or delete independent workspaces. Each record carries a workspace identifier and NEXUS filters the active in-memory records before rendering or searching. Existing single-workspace data is migrated into the original workspace the first time the upgraded app opens. Uploaded files remain in local OPFS or IndexedDB storage and are copied only when you explicitly duplicate a workspace.

Export a workspace from its workspace row or from **Settings → Import & export**. A `.nexus.zip` archive contains that workspace's records, uploaded file contents, versioned manifest, and integrity checks. Import lets you merge into the current workspace or create a separate workspace. The archive excludes authentication secrets. If your browser supports the File System Access API, you can grant a folder for the current session; otherwise the backup downloads normally. The Workspaces settings page reports uploaded file totals per workspace and across NEXUS; the Storage page reports the browser origin's full usage estimate.

Clearing this site's browser data may erase the workspace. Persistent storage is requested through Settings, but the browser controls whether it grants that request and the user can still clear site data.

## What this browser edition supports

- Files and folders, local previews for images, PDFs, and common text formats, downloads, favorites, and Trash.
- Full-screen local document, spreadsheet, presentation, note, and bookmark editors. Documents support basic rich text, local image insertion, tables, links, and HTML/text export. Spreadsheets provide a formula bar and basic aggregate formulas with CSV export. Presentations support thumbnails, slide duplication/reordering, and browser full-screen preview; text decks export as JSON.
- Notes, bookmarks, collections, local search, multiple calendars, all-day events, recurring daily/weekday/weekly/biweekly/monthly/yearly dates, task lists, and open-tab reminders.
- Independent local workspaces, workspace-specific settings and backups, custom themes, per-editor appearance preferences, and built-in coordinated themes.
- A dismissible browser-storage reminder; its privacy and recovery information remains in **Privacy & data**.
- Archive construction, parsing, and hashing run in a Web Worker.

## Browser limits

- NEXUS cannot open the browser's managed storage folder in the file explorer or read arbitrary computer folders. Users pick files to upload and may grant a backup folder in supported browsers.
- Reminders only run while NEXUS is open. Browser timers and notifications are not guaranteed after the tab or installed app is closed.
- This standalone build has no Gmail or Outlook OAuth connector. Proton Mail Bridge, Yahoo, and generic IMAP/SMTP are unavailable in a browser edition.
- DOCX/PDF document conversion, XLSX/ODS spreadsheets, PPTX/PDF presentation export, calendar synchronization, and a full per-event timezone editor are not bundled. Unsupported formats can still be stored and downloaded as files.
- Spreadsheet workbooks currently have one 16-by-8 grid; charts, filtering, sorting, freeze panes, and XLSX import/export are not included. Presentation slides are text-first; arbitrary slide shapes and PPTX/PDF export are not included.
- Rich Markdown preview, note attachments and linked-item panels, bookmark metadata fetching, and automatic favicon retrieval are not included. Bookmark information remains local and URLs are never sent to metadata services.
- Calendar recurrence edits apply to the series; per-occurrence exceptions and “this and future” edits are not implemented. Task subtasks, repeating tasks, ICS/CSV calendar interchange, EML/MBOX parsing, and selective exports are also not included yet.

No browser application can guarantee recovery after its site data is cleared. Keep a portable backup outside the browser.
