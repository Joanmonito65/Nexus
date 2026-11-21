let worker;
let sequence = 0;
const pending = new Map();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./db-worker.js', import.meta.url), { type: 'module', name: 'nexus-sqlite-worker' });
  worker.addEventListener('message', event => {
    const { id, result, error } = event.data;
    const request = pending.get(id);
    if (!request) return;
    pending.delete(id);
    if (error) request.reject(new Error(error)); else request.resolve(result);
  });
  worker.addEventListener('error', event => {
    for (const request of pending.values()) request.reject(new Error(event.message || 'Database worker failed.'));
    pending.clear();
  });
  return worker;
}

function request(type, extra = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, type, ...extra });
  });
}

export const database = {
  init: () => request('init'),
  query: (sql, params = []) => request('query', { sql, params }),
  run: (sql, params = []) => request('run', { sql, params }),
  close: () => request('close')
};
