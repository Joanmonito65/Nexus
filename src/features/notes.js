import { database } from '../database/database.js';
import { escapeHTML, dateLabel } from '../utils/helpers.js';

export async function renderNotes(selectedId=null) {
  const rows=await database.query('SELECT * FROM notes WHERE deleted_at IS NULL ORDER BY pinned DESC,updated_at DESC');
  const selected=rows.find(n=>n.id===selectedId)||rows[0];
  return `<div class="page-heading"><div><div class="eyebrow">THOUGHTS & IDEAS</div><h1>Notes</h1><p>Quick notes and knowledge, saved locally in your browser.</p></div><button class="btn primary" data-action="new-note">＋ New note</button></div>
  <div class="notes-layout"><aside class="panel notes-sidebar"><input id="notes-filter" class="search-input" placeholder="Find a note…">${rows.map(n=>`<button class="note-select ${selected?.id===n.id?'active':''}" data-action="select-note" data-id="${n.id}"><strong>${escapeHTML(n.title||'Untitled note')}</strong><small>${dateLabel(n.updated_at)}</small><span>${escapeHTML((n.content||'').slice(0,75))}</span></button>`).join('')||'<div class="empty-state">No notes yet.</div>'}</aside>
  <section class="panel note-editor">${selected?`<div class="note-actions"><span class="muted">Last edited ${dateLabel(selected.updated_at)}</span><div><button class="btn small" data-action="toggle-pin-note" data-id="${selected.id}">${selected.pinned?'Unpin':'Pin'}</button><button class="btn small danger-btn" data-action="trash-note" data-id="${selected.id}">Delete</button></div></div><input id="note-title" class="note-title-input" value="${escapeHTML(selected.title)}" data-note-id="${selected.id}" placeholder="Untitled note"><textarea id="note-content" class="note-content-input" data-note-id="${selected.id}" placeholder="Start writing…">${escapeHTML(selected.content)}</textarea><div class="save-state" id="note-save-state">Saved locally</div>`:'<div class="empty-state">Choose a note or create a new one.</div>'}</section></div>`;
}
