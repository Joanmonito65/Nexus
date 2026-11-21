import JSZip from 'jszip';
import { database } from '../database/database.js';
import { readFile, writeFile } from '../storage/opfs.js';
import { uid, now } from '../utils/helpers.js';

const TABLES = ['items','notes','bookmarks','calendars','events','task_lists','tasks','subtasks','reminders','collections','collection_items','activity','settings','app_meta'];
async function digest(buffer) {
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
}

export async function exportBackup() {
  const zip = new JSZip();
  const records = {};
  for (const table of TABLES) records[table] = await database.query(`SELECT * FROM ${table}`);
  const filePayloads = [];
  for (const item of records.items.filter(x=>x.kind==='file' && x.opfs_path)) {
    const file = await readFile(item.opfs_path);
    const data = await file.arrayBuffer();
    const archivePath = `payloads/${item.id}`;
    zip.file(archivePath, data);
    filePayloads.push({ id:item.id, path:archivePath, size:data.byteLength, sha256:await digest(data) });
  }
  const data = new TextEncoder().encode(JSON.stringify({ format:'NEXUS-BROWSER', version:1, exported_at:now(), records, filePayloads }));
  zip.file('workspace.json', data);
  const blob = await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=`NEXUS-Browser-Backup-${new Date().toISOString().slice(0,10)}.zip`; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
  return { size:blob.size };
}

export async function inspectBackup(file) {
  const zip = await JSZip.loadAsync(file);
  const manifestFile = zip.file('workspace.json');
  if (!manifestFile) throw new Error('This ZIP does not contain a NEXUS workspace.json file.');
  const payload = JSON.parse(await manifestFile.async('string'));
  if (payload.format !== 'NEXUS-BROWSER' || payload.version !== 1) throw new Error('Unsupported NEXUS backup format or version.');
  const filePayloads = payload.filePayloads || [];
  for (const entry of filePayloads) {
    const member = zip.file(entry.path);
    if (!member) throw new Error(`Backup is missing file payload ${entry.id}.`);
    const buffer = await member.async('arraybuffer');
    if (buffer.byteLength !== entry.size || await digest(buffer) !== entry.sha256) throw new Error(`Integrity check failed for file ${entry.id}.`);
  }
  const count = Object.fromEntries(TABLES.map(t=>[t,(payload.records?.[t]||[]).length]));
  return { zip, payload, count, filename:file.name };
}

export async function commitBackup(inspected) {
  const { zip, payload } = inspected;
  const records = payload.records || {};
  const order = ['calendars','task_lists','items','notes','bookmarks','events','tasks','subtasks','reminders','collections','collection_items','activity','settings'];
  let imported = 0;
  const insertedItems = new Set();
  for (const table of order) {
    const rows = [...(records[table] || [])];
    if (table === 'items') {
      const byId = new Map(rows.map(row => [row.id, row]));
      const depth = row => { let value = 0, parent = row.parent_id, safety = 0; while (parent && byId.has(parent) && safety++ < rows.length) { value++; parent = byId.get(parent).parent_id; } return value; };
      rows.sort((a,b) => depth(a) - depth(b));
    }
    for (const row of rows) {
      if (table === 'items') {
        const existing = await database.query('SELECT id FROM items WHERE id=?', [row.id]);
        if (existing.length) continue;
        insertedItems.add(row.id);
      }
      const columns = Object.keys(row);
      const placeholders = columns.map(()=>'?').join(',');
      const sql = `INSERT OR IGNORE INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`;
      await database.run(sql, columns.map(key=>row[key]));
      imported++;
    }
  }
  for (const entry of payload.filePayloads || []) {
    if (!insertedItems.has(entry.id)) continue;
    const member = zip.file(entry.path);
    const blob = await member.async('blob');
    await writeFile(entry.id, blob);
    await database.run('UPDATE items SET opfs_path=? WHERE id=?',[entry.id,entry.id]);
  }
  await database.run('INSERT OR REPLACE INTO app_meta(key,value) VALUES(?,?)',['last_import_at',now()]);
  return imported;
}
