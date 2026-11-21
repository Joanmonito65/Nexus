export const SCHEMA = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('file','folder')),
  name TEXT NOT NULL, parent_id TEXT REFERENCES items(id) ON DELETE SET NULL,
  mime TEXT, size INTEGER NOT NULL DEFAULT 0, opfs_path TEXT,
  starred INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_items_parent ON items(parent_id, deleted_at, kind);
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '', folder TEXT NOT NULL DEFAULT 'Notes', pinned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS bookmarks (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, url TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
  folder TEXT NOT NULL DEFAULT 'Bookmarks', tags TEXT NOT NULL DEFAULT '', starred INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS calendars (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL DEFAULT '#7665ef',
  description TEXT NOT NULL DEFAULT '', visible INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY, calendar_id TEXT REFERENCES calendars(id) ON DELETE SET NULL,
  title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', start_at TEXT NOT NULL, end_at TEXT NOT NULL,
  all_day INTEGER NOT NULL DEFAULT 0, location TEXT NOT NULL DEFAULT '', timezone TEXT NOT NULL,
  color TEXT, recurrence_json TEXT, important INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_start ON events(start_at, deleted_at);
CREATE TABLE IF NOT EXISTS task_lists (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL DEFAULT '#7665ef', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY, list_id TEXT REFERENCES task_lists(id) ON DELETE SET NULL,
  title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', due_at TEXT, priority TEXT NOT NULL DEFAULT 'none',
  status TEXT NOT NULL DEFAULT 'not_started', pinned INTEGER NOT NULL DEFAULT 0,
  my_day INTEGER NOT NULL DEFAULT 0, repeat_json TEXT, notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, completed_at TEXT, deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_at, status, deleted_at);
CREATE TABLE IF NOT EXISTS subtasks (
  id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY, entity_kind TEXT NOT NULL, entity_id TEXT NOT NULL,
  remind_at TEXT NOT NULL, label TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'scheduled',
  snoozed_until TEXT, created_at TEXT NOT NULL, dismissed_at TEXT
);
CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS collection_items (
  id TEXT PRIMARY KEY, collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  entity_kind TEXT NOT NULL, entity_id TEXT NOT NULL, created_at TEXT NOT NULL,
  UNIQUE(collection_id, entity_kind, entity_id)
);
CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY, action TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT OR IGNORE INTO app_meta(key,value) VALUES('schema_version','1');
`;
