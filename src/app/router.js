import { renderDashboard } from '../features/dashboard.js';
import { renderFiles, renderTrash } from '../features/files.js';
import { renderNotes } from '../features/notes.js';
import { renderBookmarks } from '../features/bookmarks.js';
import { renderCalendar } from '../features/calendar.js';
import { renderTasks } from '../features/tasks.js';
import { renderCollections, renderCollectionDetail } from '../features/collections.js';
import { searchEverywhere } from '../features/search.js';
import { renderPrivacy } from '../features/privacy.js';
import { renderSettings } from '../features/settings.js';
import { escapeHTML } from '../utils/helpers.js';
import { renderNavigation, UNAVAILABLE } from './navigation.js';

export const state = { view:'home', calendarDate:new Date(), taskFilter:'myday', folderId:null, selectedNote:null, searchTerm:'', collectionId:null, deferredInstall:null };
export function setView(view){state.view=view;return renderView();}

export async function renderView(){
 const app=document.querySelector('#app');
 app.innerHTML=`<div class="app-shell"><aside class="sidebar" id="sidebar"><div class="brand"><div class="brand-mark">N</div><div><strong>NEXUS</strong><small>BROWSER WORKSPACE</small></div><button class="sidebar-toggle" data-action="toggle-sidebar" title="Collapse sidebar">‹</button></div><nav>${renderNavigation(state.view)}</nav><div class="sidebar-bottom"><div class="local-status"><i></i><span>LOCAL STORAGE ACTIVE</span></div><div class="profile-mini"><div class="profile-avatar">N</div><div><strong>My workspace</strong><small>Stored in this browser</small></div></div></div></aside><main class="main-area"><header class="topbar"><button class="mobile-menu" data-action="mobile-menu">☰</button><div class="topbar-search"><span>⌕</span><input id="top-search" type="search" placeholder="Search your workspace…" value="${escapeHTML(state.searchTerm)}"><kbd>⌘ K</kbd></div><div class="topbar-right"><span class="online-indicator" id="network-state"><i></i><span>Offline-ready</span></span><button class="icon-btn" data-view="privacy" title="Privacy">◇</button><button class="avatar-button" data-view="settings">N</button></div></header><section class="view-container" id="view-container"></section></main></div><div id="modal-root"></div>`;
 document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===state.view));
 const container=document.querySelector('#view-container');
 if(UNAVAILABLE.has(state.view)) container.innerHTML=unavailablePage(state.view);
 else if(state.view==='home') container.innerHTML=await renderDashboard();
 else if(state.view==='files') container.innerHTML=await renderFiles(state.folderId);
 else if(state.view==='notes') container.innerHTML=await renderNotes(state.selectedNote);
 else if(state.view==='bookmarks') container.innerHTML=await renderBookmarks();
 else if(state.view==='calendar') container.innerHTML=await renderCalendar(state.calendarDate);
 else if(state.view==='tasks') container.innerHTML=await renderTasks(state.taskFilter);
 else if(state.view==='collections') container.innerHTML=state.collectionId?await renderCollectionDetail(state.collectionId):await renderCollections();
 else if(state.view==='search') container.innerHTML=await searchEverywhere(state.searchTerm);
 else if(state.view==='trash') container.innerHTML=await renderTrash();
 else if(state.view==='privacy') container.innerHTML=await renderPrivacy();
 else if(state.view==='settings') container.innerHTML=await renderSettings();
 else if(state.view==='notifications') container.innerHTML=await notificationPage();
 return container;
}

function unavailablePage(view){const names={documents:'Document editor',spreadsheets:'Spreadsheet editor',presentations:'Presentation editor',email:'Email integrations',notifications:'Notification center'};return `<div class="page-heading"><div><div class="eyebrow">NEXUS BROWSER · ROADMAP</div><h1>${names[view]}</h1><p>This module is not implemented in this release.</p></div></div><section class="panel unavailable-card"><div class="unavailable-icon">◌</div><h2>Not available yet</h2><p>This feature is intentionally marked unavailable rather than displaying controls that do not work. Your files can still be stored and downloaded in My Files.</p><span class="tag">NOT IMPLEMENTED IN 0.1.0</span></section>`;}
async function notificationPage(){const reminders=await (await import('../database/database.js')).database.query('SELECT * FROM reminders ORDER BY remind_at DESC LIMIT 100');return `<div class="page-heading"><div><div class="eyebrow">LOCAL ALERTS</div><h1>Notifications</h1><p>Browser reminders can be checked while NEXUS is open. A static PWA cannot guarantee exact-time alerts after the browser closes.</p></div><button class="btn" data-action="request-notifications">Enable browser notifications</button></div><section class="panel"><div class="panel-heading"><div><h2>Reminder history</h2><p>Saved locally in SQLite</p></div></div>${reminders.length?reminders.map(r=>`<div class="mini-row"><i class="event-dot" style="background:${r.status==='notified'?'var(--green)':'var(--amber)'}"></i><div><strong>${escapeHTML(r.label)}</strong><small>${new Date(r.remind_at).toLocaleString()} · ${escapeHTML(r.status)}</small></div></div>`).join(''):'<div class="empty-state">No reminders saved yet. Add a reminder to an event or task.</div>'}</section>`;}
