export function mountToastHost() {
  let host = document.querySelector('#toast-host');
  if (!host) { host = document.createElement('div'); host.id = 'toast-host'; host.className = 'toast-host'; document.body.append(host); }
  window.addEventListener('nexus:toast', event => {
    const toast = document.createElement('div');
    toast.className = `toast ${event.detail.error ? 'toast-error' : ''}`;
    toast.textContent = event.detail.message;
    host.append(toast);
    setTimeout(() => toast.remove(), 3400);
  });
}
