import { database } from '../database/database.js';
import { now, toast } from '../utils/helpers.js';

let timer;
let notifiedThisSession = new Set();

export async function checkDueReminders() {
  const due = await database.query("SELECT * FROM reminders WHERE status='scheduled' AND remind_at <= ?", [now()]);
  for (const reminder of due) {
    if (notifiedThisSession.has(reminder.id)) continue;
    notifiedThisSession.add(reminder.id);
    await database.run("UPDATE reminders SET status='notified' WHERE id=?", [reminder.id]);
    toast(`Reminder: ${reminder.label}`);
    if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification('NEXUS reminder', { body: reminder.label, tag: reminder.id }); } catch {}
    }
  }
}

export async function startReminderChecks() {
  await checkDueReminders();
  clearInterval(timer);
  timer = setInterval(() => checkDueReminders().catch(console.error), 30000);
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.requestPermission();
}
