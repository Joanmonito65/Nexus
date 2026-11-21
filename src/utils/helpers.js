export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const dateLabel = value => value ? new Date(value).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}) : '—';
export const dateTimeLabel = value => value ? new Date(value).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : '—';
export const bytes = value => { if(!value)return '0 B'; const u=['B','KB','MB','GB']; const i=Math.min(Math.floor(Math.log(value)/Math.log(1024)),3); return `${(value/1024**i).toFixed(i?1:0)} ${u[i]}`; };
export const slug = value => String(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export function localInputValue(date = new Date()) { const pad=n=>String(n).padStart(2,'0'); return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`; }
export function toast(message, error=false) { window.dispatchEvent(new CustomEvent('nexus:toast',{detail:{message,error}})); }
