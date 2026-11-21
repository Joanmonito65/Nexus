import { database } from '../database/database.js';
import { openOPFS } from '../storage/opfs.js';
import { requestPersistentStorage } from '../storage/storage-manager.js';
import { registerOfflineSupport } from '../services/offline.js';
import { startReminderChecks } from '../services/notifications.js';

export async function initializeWorkspace(){
  await openOPFS();
  const result=await database.init();
  const themeRows=await database.query("SELECT value FROM settings WHERE key='theme'");
  document.documentElement.dataset.theme=themeRows[0]?.value||'dark';
  let persistence=false;
  try { persistence=await requestPersistentStorage(); } catch {}
  await registerOfflineSupport();
  await startReminderChecks();
  return {...result,persistence};
}
