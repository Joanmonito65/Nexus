export async function registerOfflineSupport() {
  if (!('serviceWorker' in navigator)) return { supported:false };
  try { const registration = await navigator.serviceWorker.register('/service-worker.js'); return { supported:true, registration }; }
  catch (error) { console.warn('Service worker registration failed:', error); return { supported:false, error }; }
}
