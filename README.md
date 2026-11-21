# NEXUS Browser

**Version 0.1.0 · Browser-local workspace foundation**

NEXUS Browser is a static, modular Progressive Web App. The production website is served as static assets; it does not require a Python backend, hosted database, NEXUS account, or NEXUS API server.

The application code is delivered by the static host. Workspace data is stored locally in the current browser profile:

- SQLite WASM runs in a dedicated Web Worker and stores the main database in OPFS.
- Uploaded file contents are stored in a separate OPFS directory (`nexus-files`).
- There is no silent in-memory or temporary database fallback. If persistent SQLite OPFS cannot initialize, setup stops and explains why.
- The app requests persistent storage, and the Privacy & Data screen shows browser storage usage, quota and persistence status.
- ZIP backup export and integrity-checked import are implemented for the NEXUS Browser backup format.

## Requirements

- Node.js 22.12+ recommended for the current Vite toolchain.
- A modern browser with OPFS support and Web Workers.
- A static host that can send the cross-origin isolation headers required by SQLite WASM OPFS.

The SQLite WASM project documents that worker-based OPFS requires these HTTP response headers:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

The Vite development server and preview server set these headers in `vite.config.js`. A Vercel deployment is configured in `vercel.json`; Netlify deployment headers are provided in `public/_headers`.

References:
- SQLite WASM installation and Vite/OPFS setup: https://github.com/sqlite/sqlite-wasm
- SQLite WASM persistence details: https://sqlite.org/wasm/doc/trunk/persistence.md

## Development

From this directory:

```bash
npm install
npm run dev
```

Open the local Vite address shown in the terminal. The development server is only for local development. It is not a required production backend.

## Production build

```bash
npm install
npm run build
npm run preview
```

The static production output is in `dist/`. Deploy that directory to a static hosting provider with the COOP/COEP response headers above. The supplied Vercel and Netlify configuration files are intended to help with this.

Do not deploy without verifying the headers. If the browser cannot initialize OPFS-backed SQLite, NEXUS deliberately stops instead of switching to volatile storage.

## Current implementation status

### Implemented in this foundation

- Static PWA shell and offline service-worker asset caching.
- Modular HTML entry point, ES modules, feature modules, and separate CSS files.
- SQLite WASM worker with OPFS-backed persistent database.
- OPFS file-content storage, file upload/download, folders, rename, Trash, restore, permanent delete, and folder hierarchy metadata.
- Notes with local autosave and pinning.
- Bookmarks with local storage, favorites and explicit external-link opening.
- Multiple calendars, month view, event creation/edit/delete, and basic event reminders.
- Task lists, tasks, basic priorities, completion and due dates, plus basic reminders.
- Collections (create/list; item membership UI is not implemented yet).
- Local search across files, notes, bookmarks, events and tasks.
- Privacy dashboard, storage quota information and persistent-storage request.
- NEXUS Browser ZIP backup export, SHA-256 validation of file payloads, and merge-style backup import.
- Explicit unsupported-state pages for the document, spreadsheet, presentation and email modules.

### Not implemented yet

- Rich document editor, spreadsheet engine, presentation editor, and code editor.
- Gmail, Outlook, Proton Mail Bridge companion, or Yahoo integrations.
- Recurring event/task rule editing and recurrence exception handling.
- Advanced calendar views (day/week/year/agenda/schedule), event drag/drop and calendar visibility controls.
- Subtask creation/management, advanced task filters, tags, categories, and task list editing.
- Full notification center actions, multiple reminder schedules per entity, snooze/dismiss, and any alert guarantee while the PWA is closed. Reminders are checked only while the app is open; missed reminders are not guaranteed to fire in the background.
- ICS import/export, CSV task export/import, browser bookmark import/export, and NEXUS Local backup compatibility.
- Collection item linking UI, note/file attachments, and cross-item relationship workflows.
- Selective backup/import, version history, encryption-at-rest, and encrypted secrets vault.
- Browser compatibility testing beyond static source checks.

The navigation includes placeholders for larger roadmap modules. These are intentionally marked not implemented; there are no fake connected accounts or decorative editor buttons.

## Data safety notes

- Browser storage belongs to this origin and browser profile. A different domain or browser profile will not see the same workspace.
- Clearing the website's storage or browser profile can permanently delete the workspace. Export ZIP backups regularly.
- `navigator.storage.persist()` is requested, but the browser may refuse. A granted persistence request is not a backup.
- OPFS is local browser-managed storage, not an ordinary folder visible in the computer's file explorer.
- The static host receives requests for the website's application files. NEXUS does not upload workspace files or database records to the host.
- Opening external bookmarks is an explicit network action.
- The app does not currently implement email integrations or remote APIs.
- Browser notifications and background reminders are limited. A static PWA cannot promise exact-time notifications after the browser has fully closed without an appropriate background component.

## Project structure

```text
NEXUS Browser/
  index.html
  package.json
  vite.config.js
  vercel.json
  netlify.toml
  public/
    manifest.webmanifest
    service-worker.js
    _headers
  src/
    app/           routing, navigation, initialization
    database/      SQLite WASM worker, schema and client
    storage/       OPFS file store and quota manager
    features/      independent feature renderers
    components/    reusable UI components
    services/      backups, offline support, reminders
    styles/        design tokens, layout and feature styles
    utils/         shared helpers
  tests/
```
