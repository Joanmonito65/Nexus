import { database } from '../database/database.js';
import { escapeHTML, dateLabel } from '../utils/helpers.js';

const isoDay = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export async function renderCalendar(anchor=new Date()) {
 const year=anchor.getFullYear(), month=anchor.getMonth();
 const first=new Date(year,month,1), start=new Date(year,month,1-first.getDay());
 const end=new Date(year,month+1,1);
 const events=await database.query('SELECT e.*,c.name AS calendar_name,c.color AS calendar_color FROM events e LEFT JOIN calendars c ON c.id=e.calendar_id WHERE e.deleted_at IS NULL AND e.start_at < ? AND e.end_at >= ? ORDER BY e.start_at',[end.toISOString(),start.toISOString()]);
 const calendars=await database.query('SELECT * FROM calendars ORDER BY name');
 const byDay=new Map();
 for(const event of events){const day=isoDay(new Date(event.start_at)); if(!byDay.has(day))byDay.set(day,[]);byDay.get(day).push(event);}
 const cells=[];
 for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const key=isoDay(d);const dayEvents=byDay.get(key)||[];cells.push(`<div class="calendar-cell ${d.getMonth()!==month?'outside':''} ${key===isoDay(new Date())?'today':''}" data-action="new-event-date" data-date="${key}"><span class="calendar-day-number">${d.getDate()}</span>${dayEvents.slice(0,3).map(e=>`<button class="calendar-event" data-action="open-event" data-id="${e.id}" style="--event-color:${escapeHTML(e.color||e.calendar_color||'#7665ef')}" title="${escapeHTML(e.title)}">${escapeHTML(e.title)}</button>`).join('')}${dayEvents.length>3?`<small class="muted">+${dayEvents.length-3} more</small>`:''}</div>`);}
 return `<div class="page-heading"><div><div class="eyebrow">SCHEDULE & PLANNING</div><h1>Calendar</h1><p>Events are stored in your browser workspace.</p></div><button class="btn primary" data-action="new-event">＋ Create event</button></div>
 <section class="panel calendar-panel"><div class="calendar-toolbar"><div><button class="icon-btn" data-action="calendar-prev">‹</button><button class="btn small" data-action="calendar-today">Today</button><button class="icon-btn" data-action="calendar-next">›</button><h2>${anchor.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</h2></div><span class="muted">${Intl.DateTimeFormat().resolvedOptions().timeZone||'Local timezone'}</span></div><div class="calendar-layout"><aside class="calendar-side"><h3>My calendars</h3>${calendars.map(c=>`<div class="calendar-side-row"><i style="background:${escapeHTML(c.color)}"></i><span>${escapeHTML(c.name)}</span></div>`).join('')}<button class="btn small" data-action="new-calendar">＋ Add calendar</button></aside><div class="month-grid"><div class="weekday-row">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<span>${d}</span>`).join('')}</div><div class="month-cells">${cells.join('')}</div></div></div></section>
 <section class="panel agenda-panel"><div class="panel-heading"><div><h2>Upcoming events</h2><p>Next scheduled items</p></div></div>${events.filter(e=>new Date(e.end_at)>=new Date()).slice(0,8).map(e=>`<div class="mini-row"><i class="event-dot" style="background:${escapeHTML(e.color||e.calendar_color||'#7665ef')}"></i><div><strong>${escapeHTML(e.title)}</strong><small>${dateLabel(e.start_at)} · ${escapeHTML(e.calendar_name||'Calendar')}</small></div><button class="icon-btn" data-action="open-event" data-id="${e.id}">›</button></div>`).join('')||'<div class="empty-state">No upcoming events.</div>'}</section>`;
}
