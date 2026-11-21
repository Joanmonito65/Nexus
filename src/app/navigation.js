const NAV = [
  { group:'WORKSPACE', items:[['home','⌂','Home'],['files','▤','My Files'],['documents','▧','Documents'],['spreadsheets','▦','Spreadsheets'],['presentations','▣','Presentations'],['notes','✎','Notes']] },
  { group:'ORGANIZE', items:[['email','✉','Email'],['bookmarks','☆','Bookmarks'],['collections','▧','Collections'],['calendar','▦','Calendar'],['tasks','☑','Tasks & Reminders']] },
  { group:'SYSTEM', items:[['notifications','◷','Notifications'],['trash','⌫','Trash'],['privacy','◇','Privacy & Data'],['settings','⚙','Settings']] }
];
export function renderNavigation(active='home') {
  return NAV.map(group=>`<div class="nav-group"><div class="nav-group-label">${group.group}</div>${group.items.map(([view,icon,label])=>`<button class="nav-item ${active===view?'active':''}" data-view="${view}"><span class="nav-icon">${icon}</span><span>${label}</span></button>`).join('')}</div>`).join('');
}
export const UNAVAILABLE = new Set(['documents','spreadsheets','presentations','email']);
