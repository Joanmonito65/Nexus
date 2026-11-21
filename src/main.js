import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/dashboard.css';
import './styles/files.css';
import './styles/notes.css';
import './styles/bookmarks.css';
import './styles/calendar.css';
import './styles/tasks.css';
import './styles/collections.css';
import './styles/privacy.css';
import './styles/settings.css';
import './styles/search.css';
import './styles/responsive.css';
import { database } from './database/database.js';
import { initializeWorkspace } from './app/initialization.js';
import { renderView, setView, state } from './app/router.js';
import { showModal, closeModal } from './components/modal.js';
import { mountToastHost } from './components/toast.js';
import { writeFile, readFile, deleteFile } from './storage/opfs.js';
import { exportBackup, inspectBackup, commitBackup } from './services/backup.js';
import { requestNotificationPermission } from './services/notifications.js';
import { renderCollectionDetail } from './features/collections.js';
import { uid, now, escapeHTML, toast, localInputValue } from './utils/helpers.js';

let noteTimer;
let fileInput;
let backupInspection;

async function boot(){
  mountToastHost();
  try {
    const status=await initializeWorkspace();
    await renderView();
    document.querySelector('#network-state span').textContent=navigator.onLine?'Online':'Offline';
    if(!status.persistence) toast('Browser persistent-storage permission was not granted. Export backups regularly.',true);
    window.addEventListener('online',()=>document.querySelector('#network-state span').textContent='Online');
    window.addEventListener('offline',()=>document.querySelector('#network-state span').textContent='Offline');
    window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();state.deferredInstall=event;});
  } catch(error) {
    document.querySelector('#app').innerHTML=`<main class="setup-error"><div class="brand-mark">N</div><div class="eyebrow">NEXUS BROWSER STORAGE CHECK</div><h1>Persistent local storage is unavailable.</h1><p>${escapeHTML(error.message)}</p><p>NEXUS has stopped setup rather than silently falling back to temporary storage. Use a modern supported browser and deploy the static site with Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy headers enabled.</p><button class="btn" onclick="location.reload()">Try again</button></main>`;
  }
}

function field(label,name,type='text',value='',placeholder='') { return `<label class="form-field"><span>${label}</span><input name="${name}" type="${type}" value="${escapeHTML(value)}" placeholder="${escapeHTML(placeholder)}" ${name==='title'||name==='name'?'required':''}></label>`; }
function textarea(label,name,value='',placeholder=''){return `<label class="form-field"><span>${label}</span><textarea name="${name}" rows="3" placeholder="${escapeHTML(placeholder)}">${escapeHTML(value)}</textarea></label>`;}
function select(label,name,options){return `<label class="form-field"><span>${label}</span><select name="${name}">${options.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label>`;}

async function openForm(type,id=null){
  if(type==='folder'){
    showModal('Create folder',field('Folder name','name','text','','e.g. Projects'),'Create folder','folder'); return;
  }
  if(type==='note'){
    showModal('Create note',field('Title','title','text','','Untitled note')+textarea('Content','content','','Start writing…'),'Create note','note');return;
  }
  if(type==='bookmark'){
    showModal('Add bookmark',field('Title','title')+field('Website URL','url','url','','https://example.com')+textarea('Description','description')+field('Folder','folder','text','Bookmarks'),'Add bookmark','bookmark');return;
  }
  if(type==='calendar'){
    showModal('Create calendar',field('Name','name')+field('Color','color','color','#7665ef')+textarea('Description','description'),'Create calendar','calendar');return;
  }
  if(type==='event'){
    const calendars=await database.query('SELECT * FROM calendars ORDER BY name');
    const calendarOptions=calendars.map(c=>[c.id,escapeHTML(c.name)]);
    const base=id?new Date(`${id}T09:00`):new Date();const start=localInputValue(base);const end=localInputValue(new Date(base.getTime()+3600000));
    showModal('Create event',field('Event title','title')+textarea('Description','description')+field('Start','start','datetime-local',start)+field('End','end','datetime-local',end)+select('Calendar','calendar_id',calendarOptions)+field('Location','location')+select('Reminder','reminder',[['none','No reminder'],['0','At event time'],['5','5 minutes before'],['10','10 minutes before'],['15','15 minutes before'],['30','30 minutes before'],['60','1 hour before'],['120','2 hours before'],['1440','1 day before'],['10080','1 week before']])+`<label class="form-check"><input type="checkbox" name="all_day"> All-day event</label>`,'Create event','event');return;
  }
  if(type==='task'){
    const lists=await database.query('SELECT * FROM task_lists ORDER BY name');
    showModal('Create task',field('Task name','title')+textarea('Description','description')+field('Due date','due','datetime-local')+select('Priority','priority',[['none','None'],['low','Low'],['medium','Medium'],['high','High'],['urgent','Urgent']])+select('Task list','list_id',lists.map(l=>[l.id,escapeHTML(l.name)]))+select('Reminder','reminder',[['none','No reminder'],['0','At due time'],['5','5 minutes before'],['15','15 minutes before'],['30','30 minutes before'],['60','1 hour before'],['1440','1 day before']])+`<label class="form-check"><input type="checkbox" name="my_day"> Add to My Day</label>`,'Create task','task');return;
  }
  if(type==='task-list'){
    showModal('Create task list',field('List name','name')+field('Color','color','color','#7665ef'),'Create list','task-list');return;
  }
  if(type==='collection'){
    showModal('Create collection',field('Collection name','name')+textarea('Description','description'),'Create collection','collection');return;
  }
  if(type==='rename'){
    const row=(await database.query('SELECT * FROM items WHERE id=?',[id]))[0];
    if(!row)return;
    showModal('Rename item',field('Name','name','text',row.name),'Rename','rename');return;
  }
  if(type==='edit-event'){
    const row=(await database.query('SELECT * FROM events WHERE id=?',[id]))[0]; if(!row)return;
    const calendars=await database.query('SELECT * FROM calendars ORDER BY name');
    const options=calendars.map(c=>[c.id,escapeHTML(c.name)]);
    showModal('Edit event',field('Event title','title','text',row.title)+textarea('Description','description',row.description)+field('Start','start','datetime-local',localInputValue(new Date(row.start_at)))+field('End','end','datetime-local',localInputValue(new Date(row.end_at)))+select('Calendar','calendar_id',options)+field('Location','location','text',row.location)+select('Reminder','reminder',[['none','No reminder'],['0','At event time'],['5','5 minutes before'],['10','10 minutes before'],['15','15 minutes before'],['30','30 minutes before'],['60','1 hour before'],['120','2 hours before'],['1440','1 day before']])+`<label class="form-check"><input type="checkbox" name="all_day" ${row.all_day?'checked':''}> All-day event</label>`,'Save changes','edit-event');
    const f=document.querySelector('#nexus-modal-form');f.dataset.id=id;f.querySelector('[name=calendar_id]').value=row.calendar_id||calendars[0]?.id;return;
  }
  if(type==='edit-task'){
    const row=(await database.query('SELECT * FROM tasks WHERE id=?',[id]))[0]; if(!row)return;
    showModal('Edit task',field('Task name','title','text',row.title)+textarea('Description','description',row.description)+field('Due date','due','datetime-local',row.due_at?new Date(row.due_at).toISOString().slice(0,16):'')+select('Priority','priority',[['none','None'],['low','Low'],['medium','Medium'],['high','High'],['urgent','Urgent']].map(([v,l])=>[v,l])),'Save changes','edit-task');
    const f=document.querySelector('#nexus-modal-form');f.dataset.id=id;f.querySelector('[name=priority]').value=row.priority;return;
  }
}

async function handleForm(event){
  if(event.target.id!=='nexus-modal-form')return;
  event.preventDefault();const form=event.target;const data=new FormData(form);const v=Object.fromEntries(data.entries());const stamp=now();
  try{
    switch(form.dataset.form){
      case 'folder':{const id=uid();await database.run('INSERT INTO items(id,kind,name,parent_id,created_at,updated_at) VALUES(?,?,?,?,?,?)',[id,'folder',v.name,state.folderId,stamp,stamp]);break;}
      case 'note':{const id=uid();await database.run('INSERT INTO notes(id,title,content,created_at,updated_at) VALUES(?,?,?,?,?)',[id,v.title||'Untitled note',v.content||'',stamp,stamp]);state.selectedNote=id;break;}
      case 'bookmark':{const id=uid();let url=v.url.trim();if(!/^https?:\/\//i.test(url))throw new Error('Enter a valid http or https URL.');await database.run('INSERT INTO bookmarks(id,title,url,description,folder,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',[id,v.title,url,v.description||'',v.folder||'Bookmarks',stamp,stamp]);break;}
      case 'calendar':{await database.run('INSERT INTO calendars(id,name,color,description,visible,created_at) VALUES(?,?,?,?,1,?)',[uid(),v.name,v.color||'#7665ef',v.description||'',stamp]);break;}
      case 'event':{const start=new Date(v.start),end=new Date(v.end);if(Number.isNaN(+start)||Number.isNaN(+end)||end<start)throw new Error('Choose a valid start and end time.');const eventId=uid();await database.run('INSERT INTO events(id,calendar_id,title,description,start_at,end_at,all_day,location,timezone,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',[eventId,v.calendar_id,v.title,v.description||'',start.toISOString(),end.toISOString(),data.has('all_day')?1:0,v.location||'',Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',stamp,stamp]);if(v.reminder&&v.reminder!=='none'){const remindAt=new Date(start.getTime()-Number(v.reminder)*60000);await database.run('INSERT INTO reminders(id,entity_kind,entity_id,remind_at,label,created_at) VALUES(?,?,?,?,?,?)',[uid(),'event',eventId,remindAt.toISOString(),v.title,stamp]);}break;}
      case 'edit-event':{const start=new Date(v.start),end=new Date(v.end);if(Number.isNaN(+start)||Number.isNaN(+end)||end<start)throw new Error('Choose a valid start and end time.');const id=form.dataset.id;await database.run('UPDATE events SET calendar_id=?,title=?,description=?,start_at=?,end_at=?,all_day=?,location=?,updated_at=? WHERE id=?',[v.calendar_id,v.title,v.description||'',start.toISOString(),end.toISOString(),data.has('all_day')?1:0,v.location||'',stamp,id]);await database.run("DELETE FROM reminders WHERE entity_kind='event' AND entity_id=? AND status='scheduled'",[id]);if(v.reminder&&v.reminder!=='none'){const remindAt=new Date(start.getTime()-Number(v.reminder)*60000);await database.run('INSERT INTO reminders(id,entity_kind,entity_id,remind_at,label,created_at) VALUES(?,?,?,?,?,?)',[uid(),'event',id,remindAt.toISOString(),v.title,stamp]);}break;}
      case 'task':{const taskId=uid();const due=v.due?new Date(v.due):null;await database.run('INSERT INTO tasks(id,list_id,title,description,due_at,priority,my_day,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',[taskId,v.list_id,v.title,v.description||'',due?due.toISOString():null,v.priority||'none',data.has('my_day')?1:0,stamp,stamp]);if(due&&v.reminder&&v.reminder!=='none'){const remindAt=new Date(due.getTime()-Number(v.reminder)*60000);await database.run('INSERT INTO reminders(id,entity_kind,entity_id,remind_at,label,created_at) VALUES(?,?,?,?,?,?)',[uid(),'task',taskId,remindAt.toISOString(),v.title,stamp]);}break;}
      case 'task-list':{await database.run('INSERT INTO task_lists(id,name,color,created_at) VALUES(?,?,?,?)',[uid(),v.name,v.color||'#7665ef',stamp]);break;}
      case 'collection':{await database.run('INSERT INTO collections(id,name,description,created_at) VALUES(?,?,?,?)',[uid(),v.name,v.description||'',stamp]);break;}
      case 'collection-member':{const [kind,itemId]=v.member.split('|');await database.run('INSERT OR IGNORE INTO collection_items(id,collection_id,entity_kind,entity_id,created_at) VALUES(?,?,?,?,?)',[uid(),form.dataset.collectionId,kind,itemId,stamp]);break;}
      case 'rename':{await database.run('UPDATE items SET name=?,updated_at=? WHERE id=?',[v.name,stamp,form.dataset.id]);break;}
      case 'edit-task':{await database.run('UPDATE tasks SET title=?,description=?,due_at=?,priority=?,updated_at=? WHERE id=?',[v.title,v.description||'',v.due?new Date(v.due).toISOString():null,v.priority,stamp,form.dataset.id]);break;}
    }
    closeModal();toast('Saved locally.');await renderView();
  }catch(error){toast(error.message,true);}
}

async function uploadFiles(files){
  for(const file of files){
    const id=uid();const stamp=now();
    try{await writeFile(id,file);await database.run('INSERT INTO items(id,kind,name,parent_id,mime,size,opfs_path,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',[id,'file',file.name,state.folderId,file.type||'application/octet-stream',file.size,id,stamp,stamp]);}
    catch(error){await deleteFile(id).catch(()=>{});throw error;}
  }
  toast(`${files.length} file${files.length===1?'':'s'} stored in this browser.`);await renderView();
}

async function act(action,el){
  const id=el.dataset.id;
  switch(action){
    case 'toggle-sidebar':document.querySelector('#sidebar').classList.toggle('collapsed');break;
    case 'mobile-menu':document.querySelector('#sidebar').classList.toggle('mobile-open');break;
    case 'new-folder':openForm('folder');break;
    case 'upload-files':document.querySelector('#file-picker')?.click();break;
    case 'open-folder':state.folderId=id;await renderView();break;
    case 'folder-up':state.folderId=el.dataset.parent||null;await renderView();break;
    case 'rename-item':openForm('rename',id);break;
    case 'trash-item':{const stamp=now();await database.run('WITH RECURSIVE descendants(id) AS (SELECT id FROM items WHERE id=? UNION ALL SELECT i.id FROM items i JOIN descendants d ON i.parent_id=d.id) UPDATE items SET deleted_at=?,updated_at=? WHERE id IN (SELECT id FROM descendants)',[id,stamp,stamp]);toast('Moved to Trash.');await renderView();break;}
    case 'download-file':{const row=(await database.query('SELECT * FROM items WHERE id=?',[id]))[0];const file=await readFile(row.opfs_path);const url=URL.createObjectURL(file);const a=document.createElement('a');a.href=url;a.download=row.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);break;}
    case 'restore-trash':{const kind=el.dataset.kind;if(kind==='file'||kind==='folder')await database.run('WITH RECURSIVE descendants(id) AS (SELECT id FROM items WHERE id=? UNION ALL SELECT i.id FROM items i JOIN descendants d ON i.parent_id=d.id) UPDATE items SET deleted_at=NULL,updated_at=? WHERE id IN (SELECT id FROM descendants)',[id,now()]);else{const table={note:'notes',bookmark:'bookmarks',event:'events',task:'tasks'}[kind];if(table)await database.run(`UPDATE ${table} SET deleted_at=NULL,updated_at=? WHERE id=?`,[now(),id]);}await renderView();break;}
    case 'purge-trash':{const kind=el.dataset.kind;if(kind==='file'||kind==='folder'){const descendants=await database.query('WITH RECURSIVE tree(id,opfs_path) AS (SELECT id,opfs_path FROM items WHERE id=? UNION ALL SELECT i.id,i.opfs_path FROM items i JOIN tree t ON i.parent_id=t.id) SELECT * FROM tree',[id]);for(const row of descendants)if(row.opfs_path)await deleteFile(row.opfs_path);await database.run('WITH RECURSIVE descendants(id) AS (SELECT id FROM items WHERE id=? UNION ALL SELECT i.id FROM items i JOIN descendants d ON i.parent_id=d.id) DELETE FROM items WHERE id IN (SELECT id FROM descendants)',[id]);}else{const table={note:'notes',bookmark:'bookmarks',event:'events',task:'tasks'}[kind];if(table)await database.run(`DELETE FROM ${table} WHERE id=?`,[id]);if(kind==='event'||kind==='task')await database.run('DELETE FROM reminders WHERE entity_kind=? AND entity_id=?',[kind,id]);}await renderView();break;}
    case 'empty-trash':{if(!confirm('Permanently delete all trashed items? This cannot be undone.'))break;const rows=await database.query("SELECT * FROM items WHERE deleted_at IS NOT NULL AND kind='file'");for(const row of rows)if(row.opfs_path)await deleteFile(row.opfs_path);for(const table of ['items','notes','bookmarks','events','tasks'])await database.run(`DELETE FROM ${table} WHERE deleted_at IS NOT NULL`);await database.run("DELETE FROM reminders WHERE entity_kind IN ('event','task') AND entity_id NOT IN (SELECT id FROM events UNION SELECT id FROM tasks)");await renderView();break;}
    case 'new-note':openForm('note');break;
    case 'select-note':state.selectedNote=id;await renderView();break;
    case 'toggle-pin-note':{const row=(await database.query('SELECT pinned FROM notes WHERE id=?',[id]))[0];await database.run('UPDATE notes SET pinned=?,updated_at=? WHERE id=?',[row.pinned?0:1,now(),id]);await renderView();break;}
    case 'trash-note':await database.run('UPDATE notes SET deleted_at=?,updated_at=? WHERE id=?',[now(),now(),id]);state.selectedNote=null;await renderView();break;
    case 'new-bookmark':openForm('bookmark');break;
    case 'star-bookmark':{const row=(await database.query('SELECT starred FROM bookmarks WHERE id=?',[id]))[0];await database.run('UPDATE bookmarks SET starred=?,updated_at=? WHERE id=?',[row.starred?0:1,now(),id]);await renderView();break;}
    case 'delete-bookmark':await database.run('UPDATE bookmarks SET deleted_at=?,updated_at=? WHERE id=?',[now(),now(),id]);await renderView();break;
    case 'new-calendar':openForm('calendar');break;
    case 'new-event':openForm('event');break;
    case 'edit-event':closeModal();openForm('edit-event',id);break;
    case 'delete-event':await database.run('UPDATE events SET deleted_at=?,updated_at=? WHERE id=?',[now(),now(),id]);await database.run("DELETE FROM reminders WHERE entity_kind='event' AND entity_id=? AND status='scheduled'",[id]);closeModal();toast('Event moved to Trash.');await renderView();break;
    case 'new-event-date':if(el.dataset.date){openForm('event',el.dataset.date);}break;
    case 'open-event':{const row=(await database.query('SELECT * FROM events WHERE id=?',[id]))[0];if(row){showModal(escapeHTML(row.title),`<p>${escapeHTML(row.description||'No description')}</p><p><strong>${new Date(row.start_at).toLocaleString()}</strong> – ${new Date(row.end_at).toLocaleString()}</p><p>${escapeHTML(row.location||'')}</p><div class="inline-actions"><button type="button" class="btn" data-action="edit-event" data-id="${id}">Edit event</button><button type="button" class="btn danger-btn" data-action="delete-event" data-id="${id}">Delete event</button></div>`,'Close','event-info');document.querySelector('#nexus-modal-form button[type=submit]').textContent='Close';}break;}
    case 'calendar-prev':state.calendarDate=new Date(state.calendarDate.getFullYear(),state.calendarDate.getMonth()-1,1);await renderView();break;
    case 'calendar-next':state.calendarDate=new Date(state.calendarDate.getFullYear(),state.calendarDate.getMonth()+1,1);await renderView();break;
    case 'calendar-today':state.calendarDate=new Date();await renderView();break;
    case 'new-task':openForm('task');break;
    case 'new-task-list':openForm('task-list');break;
    case 'task-filter':state.taskFilter=el.dataset.filter;await renderView();break;
    case 'complete-task':{const row=(await database.query('SELECT status FROM tasks WHERE id=?',[id]))[0];const completed=row.status!=='completed';await database.run('UPDATE tasks SET status=?,completed_at=?,updated_at=? WHERE id=?',[completed?'completed':'not_started',completed?now():null,now(),id]);await renderView();break;}
    case 'edit-task':openForm('edit-task',id);break;
    case 'new-collection':openForm('collection');break;
    case 'open-collection':state.collectionId=id;await renderView();break;
    case 'collection-back':state.collectionId=null;await renderView();break;
    case 'add-collection-item':{const [files,notes,bookmarks,events,tasks]=await Promise.all([database.query("SELECT id,name AS title FROM items WHERE kind='file' AND deleted_at IS NULL"),database.query("SELECT id,title FROM notes WHERE deleted_at IS NULL"),database.query("SELECT id,title FROM bookmarks WHERE deleted_at IS NULL"),database.query("SELECT id,title FROM events WHERE deleted_at IS NULL"),database.query("SELECT id,title FROM tasks WHERE deleted_at IS NULL")]);const rows=[...files.map(x=>({...x,kind:'file'})),...notes.map(x=>({...x,kind:'note'})),...bookmarks.map(x=>({...x,kind:'bookmark'})),...events.map(x=>({...x,kind:'event'})),...tasks.map(x=>({...x,kind:'task'}))];if(!rows.length){toast('Create a file, note, bookmark, event, or task first.');break;}showModal('Add item to collection',`<label class="form-field"><span>Choose an existing item</span><select name="member">${rows.map(x=>`<option value="${x.kind}|${x.id}">${x.kind.toUpperCase()} · ${escapeHTML(x.title)}</option>`).join('')}</select></label>`,'Add item','collection-member');document.querySelector('#nexus-modal-form').dataset.collectionId=id;break;}
    case 'remove-collection-item':await database.run('DELETE FROM collection_items WHERE id=?',[id]);await renderView();break;
    case 'request-persistence':{const granted=await navigator.storage.persist();toast(granted?'Persistent storage was granted.':'The browser did not grant persistent storage.',!granted);await renderView();break;}
    case 'export-backup':{const result=await exportBackup();toast(`Backup exported · ${Math.round(result.size/1024)} KB`);break;}
    case 'import-backup':document.querySelector('#backup-input')?.click();break;
    case 'delete-workspace':{if(!confirm('Delete all NEXUS Browser workspace data from this origin? Export a backup first. This cannot be undone.'))break;const files=await database.query("SELECT opfs_path FROM items WHERE kind='file'");for(const f of files)if(f.opfs_path)await deleteFile(f.opfs_path);for(const table of ['items','notes','bookmarks','events','tasks','subtasks','reminders','collections','collection_items','activity','settings','calendars','task_lists'])await database.run(`DELETE FROM ${table}`);await database.run('INSERT INTO calendars(id,name,color,description,visible,created_at) VALUES(?,?,?,?,1,?)',['cal-personal','Personal','#7665ef','Your personal calendar',now()]);await database.run('INSERT INTO task_lists(id,name,color,created_at) VALUES(?,?,?,?)',['list-default','My Tasks','#7665ef',now()]);toast('Local workspace content deleted.');state.view='home';await renderView();break;}
    case 'request-notifications':{const result=await requestNotificationPermission();toast(result==='granted'?'Browser notifications enabled.':`Notification permission: ${result}`,result!=='granted');break;}
    case 'install-pwa':if(state.deferredInstall){state.deferredInstall.prompt();state.deferredInstall=null;}else toast('Use your browser menu’s Install App or Add to Home Screen option.');break;
    case 'open-search-result':state.view=el.dataset.kind==='note'?'notes':el.dataset.kind==='bookmark'?'bookmarks':el.dataset.kind==='event'?'calendar':el.dataset.kind==='task'?'tasks':'files';state.selectedNote=el.dataset.kind==='note'?id:null;await renderView();break;
    case 'close-modal':closeModal();break;
  }
}

document.addEventListener('click',async event=>{
  if(event.target.closest('[data-close-modal]')){closeModal();return;}
  const nav=event.target.closest('[data-view]');if(nav){state.folderId=null;await setView(nav.dataset.view);return;}
  const action=event.target.closest('[data-action]');if(action){if(action.hasAttribute('data-close-modal')){closeModal();return;}try{await act(action.dataset.action,action);}catch(error){toast(error.message||'Action failed.',true);}return;}
  if(event.target.classList.contains('modal-backdrop'))closeModal();
});
document.addEventListener('submit',async event=>{
  if(event.target.dataset.form==='import-backup-confirm'){event.preventDefault();try{const count=await commitBackup(backupInspection);closeModal();toast(`Imported ${count} records. Existing items were preserved.`);await renderView();}catch(error){toast(error.message,true);}return;}
  handleForm(event);
});
document.addEventListener('change',async event=>{
  if(event.target.id==='file-picker'){const files=[...event.target.files];if(files.length)try{await uploadFiles(files);}catch(error){toast(error.message,true);}event.target.value='';}
  if(event.target.id==='backup-input'){const file=event.target.files[0];if(file)try{backupInspection=await inspectBackup(file);const counts=Object.entries(backupInspection.count).filter(([,n])=>n).map(([k,n])=>`${k}: ${n}`).join('<br>');showModal('Backup verified',`<p><strong>${escapeHTML(file.name)}</strong></p><p class="muted">Integrity checks passed. This import merges records and preserves existing items.</p><div class="backup-counts">${counts||'No records found'}</div>`,'Import backup','import-backup-confirm');}catch(error){toast(error.message,true);}event.target.value='';}
  if(event.target.id==='theme-select'){await database.run('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)',['theme',event.target.value]);document.documentElement.dataset.theme=event.target.value;}
});
document.addEventListener('input',event=>{
  if(event.target.id==='note-title'||event.target.id==='note-content'){
    clearTimeout(noteTimer);const id=event.target.dataset.noteId;const title=document.querySelector('#note-title')?.value||'Untitled note';const content=document.querySelector('#note-content')?.value||'';const label=document.querySelector('#note-save-state');if(label)label.textContent='Saving…';
    noteTimer=setTimeout(async()=>{try{await database.run('UPDATE notes SET title=?,content=?,updated_at=? WHERE id=?',[title,content,now(),id]);if(label)label.textContent='Saved locally';}catch(error){toast(error.message,true);}},400);
  }
  if(event.target.id==='file-search'){const q=event.target.value.toLowerCase();document.querySelectorAll('#file-rows tr[data-searchable]').forEach(row=>row.hidden=!row.dataset.searchable.includes(q));}
  if(event.target.id==='notes-filter'){const q=event.target.value.toLowerCase();document.querySelectorAll('.note-select').forEach(row=>row.hidden=!row.textContent.toLowerCase().includes(q));}
  if(event.target.id==='bookmark-filter'){const q=event.target.value.toLowerCase();document.querySelectorAll('#bookmark-grid [data-searchable]').forEach(row=>row.hidden=!row.dataset.searchable.includes(q));}
  if(event.target.id==='task-search'){const q=event.target.value.toLowerCase();document.querySelectorAll('.task-row').forEach(row=>row.hidden=!row.textContent.toLowerCase().includes(q));}
  if(event.target.id==='top-search'){state.searchTerm=event.target.value;clearTimeout(window.__nexusTopSearchTimer);window.__nexusTopSearchTimer=setTimeout(async()=>{if(state.searchTerm.trim()){state.view='search';await renderView();const input=document.querySelector('#top-search');input?.focus();input?.setSelectionRange(input.value.length,input.value.length);}},220);}
  if(event.target.id==='global-search-page'){state.searchTerm=event.target.value;clearTimeout(window.__nexusSearchTimer);window.__nexusSearchTimer=setTimeout(async()=>{await renderView();const input=document.querySelector('#global-search-page');input?.focus();input?.setSelectionRange(input.value.length,input.value.length);},250);}
});

document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();document.querySelector('#top-search')?.focus();}if(event.key==='Escape')closeModal();});
window.addEventListener('DOMContentLoaded',boot);
