# NEXUS Browser

NEXUS Browser is a static, local-first workspace. It has no NEXUS server, account, telemetry, or cloud data API. Workspace records are stored in IndexedDB. Uploaded file contents use the browser's Origin Private File System when available and fall back to IndexedDB. This build does not bundle SQLite compiled to WebAssembly; IndexedDB is the main record store.

## Run it

Recommended: double-click `run-nexus.bat` on Windows, or run `./run-nexus.sh` on macOS/Linux (make it executable once with `chmod +x run-nexus.sh`). The scripts start Python's standard-library static server on `127.0.0.1:4173`. After the server starts, open:

```text
http://127.0.0.1:4173
```

The server binds only to the loopback interface. It serves the static application files and does not access the browser database, send workspace data anywhere, or expose the server to other computers on the network. Stop it with Ctrl+C. Python 3 must be installed.

You can also start the server manually from this folder:

```powershell
py -m http.server 4173 --bind 127.0.0.1
```

The service worker caches the app shell for offline use after the first load. IndexedDB is required for workspace records. OPFS and installable PWA behavior depend on browser support.

## Browser storage by launch method

| Feature | Direct `file://` | Loopback `http://127.0.0.1:4173` | HTTPS |
| --- | --- | --- | --- |
| App HTML, CSS, and JavaScript | Loads from local files | Served from this computer | Served by the chosen HTTPS host |
| IndexedDB records and settings | Browser-dependent; file origins may be opaque or path-specific | Available in modern browsers when enabled | Available in modern browsers when enabled |
| `localStorage` preferences | Behavior is undefined for file URLs; NEXUS treats it as optional and guards access | Normally available; NEXUS uses it only for small optional preferences | Normally available; NEXUS uses it only for small optional preferences |
| Quota estimate and persistent-storage request | May be missing or restricted | Feature-detected; estimates and grants depend on the browser | Feature-detected; estimates and grants depend on the browser |
| OPFS file storage | Browser-dependent; NEXUS falls back to IndexedDB if access fails | Available when the browser supports it; NEXUS falls back to IndexedDB | Available when the browser supports it; NEXUS falls back to IndexedDB |
| Service worker | NEXUS skips registration for `file://` | Available in supporting browsers; caches app files offline | Available in supporting browsers; caches app files offline |
| ZIP backup import/export worker | May be restricted by file-origin rules | Available in supporting browsers | Available in supporting browsers |

File URL storage is not consistently defined across browsers. Browser documentation describes `localStorage` for `file:` as undefined and notes that file origins may be opaque. IndexedDB follows origin separation, so a file URL, `http://127.0.0.1:4173`, another localhost port, and an HTTPS site can each have separate databases. [MDN: `localStorage` on file URLs](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage), [MDN: IndexedDB origins](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Basic_Terminology), [MDN: secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts).

NEXUS handles local-storage errors without blocking startup, but direct-file mode cannot promise reliable persistence or worker-based backup behavior on every browser. Use the loopback launcher for dependable local use. Switching launch methods will not move or overwrite existing data. Export a backup from the old origin and import it into the new origin; keep the backup until you have confirmed the imported workspace and files.

The Storage diagnostics page reports what the current browser actually exposes through feature detection. Storage estimates are approximate, and a persistent-storage request can be denied. OPFS is origin-private browser storage and is quota-managed; IndexedDB is the fallback for file contents. [MDN: OPFS](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system), [MDN: storage quotas and estimates](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

You can also host these static files on a server you control. That host can see normal web requests for the app files, but NEXUS does not send workspace records or uploaded content to it.

## Workspaces and backups

Open **Settings → Workspaces** to create, switch, rename, duplicate, archive, restore, export, import, or delete independent workspaces. Each record carries a workspace identifier and NEXUS filters the active in-memory records before rendering or searching. Existing single-workspace data is migrated into the original workspace the first time the upgraded app opens. Uploaded files remain in local OPFS or IndexedDB storage and are copied only when you explicitly duplicate a workspace.

Export a workspace from its workspace row or from **Settings → Import & export**. A `.nexus.zip` archive contains that workspace's records, uploaded file contents, versioned manifest, and integrity checks. Import lets you merge into the current workspace or create a separate workspace. The archive excludes authentication secrets. If your browser supports the File System Access API, you can grant a folder for the current session; otherwise the backup downloads normally. The Workspaces settings page reports uploaded file totals per workspace and across NEXUS; the Storage page reports the browser origin's full usage estimate.

Clearing this site's browser data may erase the workspace. Persistent storage is requested through Settings, but the browser controls whether it grants that request and the user can still clear site data.

## What this browser edition supports

- Files and folders, local previews for images, PDFs, and common text formats, downloads, favorites, and Trash.
- Local document, multi-sheet spreadsheet, presentation, note, drawing, and bookmark editors. Documents support basic rich text, local image insertion, tables, links, per-document theme-following or custom surface/text colors, and HTML/text export. Notes support the same appearance modes and saved surface/text colors. Presentations support thumbnails, slide duplication/reordering, and browser full-screen preview; text decks export as JSON.
- Drawing Studio supports freehand brushes, adjustable size/opacity/smoothing, shapes and labels, text styling, image import, selection/move/resize/rotate, layers, saved colors, canvas sizing/grid/transparency, undo/redo, and SVG/PNG/JPG export. Drawings autosave as workspace records and are included in workspace backups. Search includes drawings.
- Spreadsheets include a formula bar, range selection, formatting controls, multiple sheets, sorting/filtering, find/replace, charts, undo/redo, and CSV import/export. The safe formula engine calculates common math, logical, text, date, conditional aggregate, and lookup functions, including cross-sheet references and circular-reference errors.
- Tasks support status and priority, categories and tags, custom lists, search, pin/star, duplication, My Day, recurring due dates, subtasks, and reminder settings. The Agenda combines dated events and tasks with search and completed-task visibility.
- Calendar day, week, month, year, agenda, schedule, and reminder views include date navigation, multiple colored calendars, recurrence rules, recurrence occurrence editing, and basic ICS import/export. Reminder badges appear in calendar and agenda views; reminder history supports upcoming, overdue, completed, and dismissed states, snoozing, and dismissal. The optional built-in US Holidays calendar distinguishes federal holidays, cultural events, remembrance dates, and informal observances, and calculates moving dates such as Easter, Thanksgiving, and Memorial Day.
- Bookmarks support built-in icons, uploaded local images, remote image URLs, and optional local copies. The Install App panel detects common device platforms and explains installation steps.
- Independent local workspaces, workspace-specific settings and backups, custom themes, per-editor appearance preferences, and built-in coordinated themes.
- A dismissible browser-storage reminder; its privacy and recovery information remains in **Privacy & data**.
- Archive construction, parsing, and hashing run in a Web Worker.

## Browser limits

- NEXUS cannot open the browser's managed storage folder in the file explorer or read arbitrary computer folders. Users pick files to upload and may grant a backup folder in supported browsers.
- Drawing Studio does not yet include object cropping, canvas panning, rulers/guides/snapping, custom freeform shapes, gradient or pattern backgrounds, or PDF export. Touch and stylus input use browser pointer events; detailed small-screen drawing interaction still needs hands-on testing.
- Reminder checks run while NEXUS is open. Browser timers and notifications are not guaranteed after the tab or installed app is closed; there is no remote push service.
- This standalone build has no Gmail or Outlook OAuth connector. Proton Mail Bridge, Yahoo, and generic IMAP/SMTP are unavailable in a browser edition.
- DOCX/PDF document conversion, XLSX/ODS spreadsheets, PPTX/PDF presentation export, calendar synchronization, and a full per-event timezone editor are not bundled. Unsupported formats can still be stored and downloaded as files.
- Spreadsheet formulas cover a useful subset, not full Excel or Google Sheets compatibility. XLSX/ODS, external clipboard integration, formula autocomplete, conditional-format evaluation, data validation, real frozen panes, and advanced chart axes/legends are not included. Charts save their type, title, and range in the workbook and render as local SVGs; CSV transfer does not preserve styles or workbook structure. Presentation slides are text-first; arbitrary slide shapes and PPTX/PDF export are not included.
- Calendar ICS support focuses on common VEVENT date, time, summary, description, location, basic recurrence, and reminder fields. Timezone definitions, exception dates, attendees, alarms beyond simple display reminders, and some complex recurrence rules may not round-trip. Event attachments and per-event timezone editing are not included. Calendar dates use the device's local timezone.
- Task attachments and linked-item panels are not included. Recurring tasks create agenda occurrences and reminders from their due date, but completing one occurrence does not generate a separate next task record.
- Browser install eligibility and the platform-specific installation flows depend on the browser, HTTPS/localhost origin, and device. The tutorial explains supported menu routes, but this static output has not been interactively verified on each device.
- Rich Markdown preview, note attachments and linked-item panels, bookmark metadata fetching, and automatic favicon retrieval are not included. Bookmark information remains local and URLs are never sent to metadata services.
- The current local `file://` tab loaded Home and displayed the full navigation during the latest startup check. This is a single-browser observation, not cross-browser verification; detailed touch selection, resizing, and small-screen editor interaction still need hands-on testing. Use the loopback launcher for dependable primary storage and verify backups before changing browser origins.
- EML/MBOX parsing and selective exports are not included.

No browser application can guarantee recovery after its site data is cleared. Keep a portable backup outside the browser.
