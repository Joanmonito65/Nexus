import { database } from '../database/database.js';
import { escapeHTML, dateLabel } from '../utils/helpers.js';

export async function renderCollections(){
 const rows=await database.query('SELECT * FROM collections ORDER BY name');
 return `<div class="page-heading"><div><div class="eyebrow">GROUP RELATED WORK</div><h1>Collections</h1><p>Bring related files and planning items together without duplicating them.</p></div><button class="btn primary" data-action="new-collection">＋ New collection</button></div><div class="collection-grid">${rows.length?rows.map(c=>`<article class="panel collection-card"><span class="collection-icon">▧</span><h3>${escapeHTML(c.name)}</h3><p>${escapeHTML(c.description)}</p><small>Created ${dateLabel(c.created_at)}</small><button class="btn small" data-action="open-collection" data-id="${c.id}">Open collection</button></article>`).join(''):'<div class="panel empty-state">No collections yet.</div>'}</div>`;
}

export async function renderCollectionDetail(id){
 const collection=(await database.query('SELECT * FROM collections WHERE id=?',[id]))[0];
 if(!collection)return '<div class="empty-state">Collection not found.</div>';
 const members=await database.query('SELECT * FROM collection_items WHERE collection_id=? ORDER BY created_at DESC',[id]);
 const labels=[];
 for(const member of members){
  const table={file:'items',note:'notes',bookmark:'bookmarks',event:'events',task:'tasks'}[member.entity_kind];
  if(!table)continue;
  const row=(await database.query(`SELECT * FROM ${table} WHERE id=?`,[member.entity_id]))[0];
  if(row)labels.push({...member,title:row.name||row.title,detail:member.entity_kind});
 }
 return `<div class="page-heading"><div><div class="eyebrow">COLLECTION</div><h1>${escapeHTML(collection.name)}</h1><p>${escapeHTML(collection.description)}</p></div><div class="heading-actions"><button class="btn" data-action="collection-back">Back</button><button class="btn primary" data-action="add-collection-item" data-id="${id}">＋ Add item</button></div></div><section class="panel">${labels.length?labels.map(m=>`<div class="mini-row"><span class="file-glyph">${({file:'▤',note:'✎',bookmark:'↗',event:'▦',task:'☑'})[m.entity_kind]||'•'}</span><div><strong>${escapeHTML(m.title||'Untitled')}</strong><small>${m.detail}</small></div><button class="icon-btn" data-action="remove-collection-item" data-id="${m.id}">×</button></div>`).join(''):'<div class="empty-state">This collection is empty. Add existing files, notes, bookmarks, events, or tasks.</div>'}</section>`;
}
