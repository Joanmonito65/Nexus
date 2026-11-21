let rootHandle;
let filesHandle;

export async function openOPFS() {
  if (!navigator.storage?.getDirectory) throw new Error('This browser does not expose the Origin Private File System (OPFS).');
  rootHandle = await navigator.storage.getDirectory();
  filesHandle = await rootHandle.getDirectoryHandle('nexus-files', { create: true });
  return { rootHandle, filesHandle };
}

export async function writeFile(path, blob) {
  if (!filesHandle) await openOPFS();
  const handle = await filesHandle.getFileHandle(path, { create: true });
  const writable = await handle.createWritable();
  try { await writable.write(blob); await writable.close(); }
  catch (error) { try { await writable.abort(); } catch {} throw error; }
}

export async function readFile(path) {
  if (!filesHandle) await openOPFS();
  const handle = await filesHandle.getFileHandle(path);
  return handle.getFile();
}

export async function deleteFile(path) {
  if (!filesHandle) await openOPFS();
  try { await filesHandle.removeEntry(path); } catch (error) { if (error.name !== 'NotFoundError') throw error; }
}

export async function fileExists(path) {
  if (!filesHandle) await openOPFS();
  try { await filesHandle.getFileHandle(path); return true; } catch (error) { if (error.name === 'NotFoundError') return false; throw error; }
}
