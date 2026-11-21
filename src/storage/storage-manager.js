export async function getStorageInfo() {
  if (!navigator.storage?.estimate) return { usage: 0, quota: 0, percent: 0, persistent: false };
  const estimate = await navigator.storage.estimate();
  let persistent = false;
  try { persistent = await navigator.storage.persisted(); } catch {}
  const usage = estimate.usage || 0;
  const quota = estimate.quota || 0;
  return { usage, quota, percent: quota ? Math.round((usage / quota) * 100) : 0, persistent };
}

export async function requestPersistentStorage() {
  if (!navigator.storage?.persist) return false;
  return navigator.storage.persist();
}

export function formatBytes(value = 0) {
  if (!value) return '0 B';
  const units = ['B','KB','MB','GB','TB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`;
}
