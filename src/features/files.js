import { database } from '../database/database.js';
import { escapeHTML, bytes, dateLabel } from '../utils/helpers.js';

export async function renderFiles(parentId=null) {
  const rows = await database.query('SELECT * FROM items WHERE parent_id IS ? AND deleted_at IS NULL ORDER BY kind DESC,name COLLATE NOCASE',[parentId]);
  const parent = parentId ? (await database.query('SELECT id,name,parent_id FROM items WHERE id=?',[parentId]))[0] : null;
  const folders = rows.filter(x=>x.kind==='folder');
  const files = rows.filter(x=>x.kind==='file');
  return `<div class="page-heading"><div><div class="eyebrow">YOUR LOCAL LIBRARY</div><h1>My Files</h1><p>Files are kept in this browser's private storage, not uploaded to a server.</p></div><div class="heading-actions">${parent?`<button class="btn" data-action="folder-up" data-parent="${parent.parent_id||''}">← Back from ${escapeHTML(parent.name)}</button>`:''}<button class="btn" data-action="new-folder">＋ New folder</button><button class="btn primary" data-action="upload-files">Upload files</button></div></div>
    <div class="toolbar"><span class="muted">${folders.length} folders · ${files.length} files</span><input id="file-search" class="search-input compact" type="search" placeholder="Filter this folder…"></div>
    <section class="panel table-panel"><table class="data-table"><thead><tr><th>Name</th><th>Type</th><th>Size</th><th>Modified</th><th></th></tr></thead><tbody id="file-rows">${rows.length?rows.map(item=>`<tr data-searchable="${escapeHTML(item.name.toLowerCase())}"><td><span class="file-icon">${item.kind==='folder'?'▰':'▤'}</span><strong>${escapeHTML(item.name)}</strong></td><td>${item.kind==='folder'?'Folder':escapeHTML(item.mime||'File')}</td><td>${item.kind==='folder'?'—':bytes(item.size)}</td><td>${dateLabel(item.updated_at)}</td><td class="row-actions">${item.kind==='folder'?`<button class="icon-btn" data-action="open-folder" data-id="${item.id}" title="Open folder">↗</button>`:`<button class="icon-btn" data-action="download-file" data-id="${item.id}" title="Download">↓</button>`}<button class="icon-btn" data-action="rename-item" data-id="${item.id}" title="Rename">✎</button><button class="icon-btn danger" data-action="trash-item" data-id="${item.id}" title="Move to trash">×</button></td></tr>`).join(''):'<tr><td colspan="5"><div class="empty-state">This folder is empty. Upload a file or create a folder to get started.</div></td></tr>'}</tbody></table></section>
    <input id="file-picker" type="file" multiple hidden />`;
}

export async function renderTrash() {
  const [items,notes,bookmarks,events,tasks]=await Promise.all([
    database.query('SELECT id,name,kind,deleted_at FROM items WHERE deleted_at IS NOT NULL'),
    database.query("SELECT id,title AS name,'note' AS kind,deleted_at FROM notes WHERE deleted_at IS NOT NULL"),
    database.query("SELECT id,title AS name,'bookmark' AS kind,deleted_at FROM bookmarks WHERE deleted_at IS NOT NULL"),
    database.query("SELECT id,title AS name,'event' AS kind,deleted_at FROM events WHERE deleted_at IS NOT NULL"),
    database.query("SELECT id,title AS name,'task' AS kind,deleted_at FROM tasks WHERE deleted_at IS NOT NULL")
  ]);
  const rows=[...items,...notes,...bookmarks,...events,...tasks].sort((a,b)=>(b.deleted_at||'').localeCompare(a.deleted_at||''));
  return `<div class="page-heading"><div><div class="eyebrow">RECOVERY</div><h1>Trash</h1><p>Restore or permanently remove deleted workspace items.</p></div><button class="btn danger-btn" data-action="empty-trash">Empty trash</button></div><section class="panel table-panel"><table class="data-table"><thead><tr><th>Name</th><th>Type</th><th>Deleted</th><th></th></tr></thead><tbody>${rows.length?rows.map(x=>`<tr><td><strong>${escapeHTML(x.name)}</strong></td><td>${escapeHTML(x.kind)}</td><td>${dateLabel(x.deleted_at)}</td><td class="row-actions"><button class="btn small" data-action="restore-trash" data-id="${x.id}" data-kind="${x.kind}">Restore</button><button class="btn small danger-btn" data-action="purge-trash" data-id="${x.id}" data-kind="${x.kind}">Delete permanently</button></td></tr>`).join(''):'<tr><td colspan="4"><div class="empty-state">Trash is empty.</div></td></tr>'}</tbody></table></section>`;
}
