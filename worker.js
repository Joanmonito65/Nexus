/* Local archive work stays off the UI thread. ZIP entries use the store method. */
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let value = n;
    for (let i = 0; i < 8; i++) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    table[n] = value >>> 0;
  }
  return table;
})();
const crc32 = data => {
  let value = 0xffffffff;
  for (const byte of data) value = crcTable[(value ^ byte) & 255] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
};
const sha256 = async data => {
  if (!self.crypto?.subtle) return null;
  const digest = await self.crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
};
const concat = chunks => {
  const result = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
};
const makeZip = entries => {
  const localHeaders = [], centralHeaders = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name), data = entry.data;
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length + data.length), lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0, true); lv.setUint16(8, 0, true);
    lv.setUint16(10, 0, true); lv.setUint16(12, 0, true); lv.setUint32(14, crc, true); lv.setUint32(18, data.length, true); lv.setUint32(22, data.length, true);
    lv.setUint16(26, name.length, true); lv.setUint16(28, 0, true); local.set(name, 30); local.set(data, 30 + name.length); localHeaders.push(local);
    const central = new Uint8Array(46 + name.length), cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0, true); cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true); cv.setUint16(14, 0, true); cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true); cv.setUint16(30, 0, true); cv.setUint16(32, 0, true); cv.setUint16(34, 0, true); cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true); cv.setUint32(42, offset, true); central.set(name, 46); centralHeaders.push(central); offset += local.length;
  }
  const centralDirectory = concat(centralHeaders), end = new Uint8Array(22), view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true); view.setUint16(4, 0, true); view.setUint16(6, 0, true); view.setUint16(8, entries.length, true); view.setUint16(10, entries.length, true);
  view.setUint32(12, centralDirectory.length, true); view.setUint32(16, offset, true); view.setUint16(20, 0, true);
  return concat([...localHeaders, centralDirectory, end]);
};
const parseZip = bytes => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), files = new Map();
  let offset = 0;
  while (offset + 4 <= bytes.length && view.getUint32(offset, true) === 0x04034b50) {
    if (offset + 30 > bytes.length) throw new Error('Archive is incomplete.');
    const method = view.getUint16(offset + 8, true), expectedCrc = view.getUint32(offset + 14, true), size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true), extraLength = view.getUint16(offset + 28, true);
    if (method !== 0) throw new Error('This archive uses compression not supported by this build.');
    const name = decoder.decode(bytes.subarray(offset + 30, offset + 30 + nameLength));
    const start = offset + 30 + nameLength + extraLength, end = start + size;
    if (end > bytes.length) throw new Error('Archive entry is truncated.');
    const content = bytes.slice(start, end);
    if (crc32(content) !== expectedCrc) throw new Error(`Integrity check failed for ${name}.`);
    files.set(name, content); offset = end;
  }
  return files;
};
self.onmessage = async event => {
  try {
    const request = event.data;
    if (request.kind === 'export') {
      const workspace = request.workspace;
      const entries = [], checks = [];
      for (const file of request.fileEntries || []) {
        const data = new Uint8Array(file.buffer), path = `files/${file.id}`;
        entries.push({ name: path, data });
        checks.push({ id: file.id, path, size: data.length, sha256: await sha256(data) });
      }
      const workspaceBytes = encoder.encode(JSON.stringify(workspace));
      entries.unshift({ name: 'workspace.json', data: workspaceBytes });
      const manifest = {
        format: 'nexus-portable-archive', version: 1, createdAt: new Date().toISOString(), edition: 'NEXUS Browser',
        itemCount: workspace.items.length, fileCount: checks.length,
        checksums: { 'workspace.json': await sha256(workspaceBytes) }, files: checks,
        security: { authenticationSecretsIncluded: false }
      };
      entries.unshift({ name: 'manifest.json', data: encoder.encode(JSON.stringify(manifest, null, 2)) });
      const archive = makeZip(entries);
      self.postMessage({ ok: true, archive: archive.buffer }, [archive.buffer]);
      return;
    }
    if (request.kind === 'import') {
      const files = parseZip(new Uint8Array(request.buffer));
      const manifestBytes = files.get('manifest.json'), workspaceBytes = files.get('workspace.json');
      if (!manifestBytes || !workspaceBytes) throw new Error('This ZIP does not contain a NEXUS workspace manifest.');
      const manifest = JSON.parse(decoder.decode(manifestBytes));
      if (manifest.format !== 'nexus-portable-archive' || manifest.version !== 1) throw new Error('Unsupported NEXUS archive version.');
      const expectedWorkspaceHash = manifest.checksums?.['workspace.json'];
      if (expectedWorkspaceHash) {
        const actual = await sha256(workspaceBytes);
        if (actual && actual !== expectedWorkspaceHash) throw new Error('Integrity check failed for workspace.json.');
      }
      const workspace = JSON.parse(decoder.decode(workspaceBytes)), fileEntries = [], transfer = [];
      for (const entry of manifest.files || []) {
        const bytes = files.get(entry.path);
        if (!bytes) throw new Error(`Missing file content for ${entry.id}.`);
        if (entry.sha256) { const actual = await sha256(bytes); if (actual && actual !== entry.sha256) throw new Error(`SHA-256 check failed for ${entry.path}.`); }
        const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        fileEntries.push({ id: entry.id, buffer }); transfer.push(buffer);
      }
      self.postMessage({ ok: true, manifest, workspace, fileEntries }, transfer);
      return;
    }
    throw new Error('Unsupported background operation.');
  } catch (error) {
    self.postMessage({ ok: false, error: error?.message || String(error) });
  }
};
