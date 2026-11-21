import { database } from '../database/database.js';
import { escapeHTML, dateLabel } from '../utils/helpers.js';

export async function renderTasks(filter='all') {
 const lists=await database.query('SELECT * FROM task_lists ORDER BY name');
 let where="deleted_at IS NULL"; const today=new Date().toISOString().slice(0,10);
 if(filter==='completed')where+=" AND status='completed'";
 else if(filter==='overdue')where+=` AND due_at < '${today}' AND status NOT IN ('completed','cancelled')`;
 else if(filter==='today')where+=` AND date(due_at)='${today}'`;
 else if(filter==='myday')where+=` AND (my_day=1 OR date(due_at)='${today}')`;
 else if(filter==='upcoming')where+=` AND due_at >= '${today}' AND status NOT IN ('completed','cancelled')`;
 else where+=" AND status!='cancelled'";
 const tasks=await database.query(`SELECT t.*,l.name AS list_name FROM tasks t LEFT JOIN task_lists l ON l.id=t.list_id WHERE ${where} ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END, due_at`);
 const subtasks=await database.query('SELECT task_id,COUNT(*) AS total,SUM(completed) AS done FROM subtasks GROUP BY task_id');
 const progress=new Map(subtasks.map(s=>[s.task_id,s]));
 return `<div class="page-heading"><div><div class="eyebrow">PERSONAL PLANNER</div><h1>Tasks & Reminders</h1><p>Organize next steps, deadlines, and everyday priorities.</p></div><button class="btn primary" data-action="new-task">＋ New task</button></div>
 <div class="task-layout"><aside class="panel task-nav"><div class="eyebrow">SMART LISTS</div>${[['myday','My Day'],['today','Today'],['upcoming','Upcoming'],['overdue','Overdue'],['completed','Completed'],['all','All tasks']].map(([k,l])=>`<button class="task-filter ${filter===k?'active':''}" data-action="task-filter" data-filter="${k}">${l}</button>`).join('')}<div class="eyebrow list-heading">MY LISTS <button class="icon-btn" data-action="new-task-list">＋</button></div>${lists.map(l=>`<div class="task-list-name"><i style="background:${escapeHTML(l.color)}"></i>${escapeHTML(l.name)}</div>`).join('')}</aside>
 <section class="panel task-main"><div class="panel-heading"><div><h2>${({myday:'My Day',today:'Today',upcoming:'Upcoming',overdue:'Overdue',completed:'Completed',all:'All tasks'})[filter]||'Tasks'}</h2><p>${tasks.length} item${tasks.length===1?'':'s'}</p></div><input class="search-input compact" id="task-search" placeholder="Search tasks…"></div>${tasks.length?tasks.map(t=>{const p=progress.get(t.id);return `<article class="task-row"><button class="check-circle ${t.status==='completed'?'done':''}" data-action="complete-task" data-id="${t.id}" aria-label="Toggle complete">${t.status==='completed'?'✓':''}</button><div class="task-copy"><strong>${escapeHTML(t.title)}</strong><small>${t.due_at?`Due ${dateLabel(t.due_at)}`:'No due date'} · ${escapeHTML(t.list_name||'My Tasks')}</small>${p?`<div class="subtask-progress"><i style="width:${p.total?Math.round((p.done/p.total)*100):0}%"></i></div>`:''}</div><span class="priority priority-${t.priority}">${escapeHTML(t.priority)}</span><button class="icon-btn" data-action="edit-task" data-id="${t.id}">⋯</button></article>`;}).join(''):'<div class="empty-state">Nothing here right now. Add a task to get started.</div>'}</section></div>`;
}
