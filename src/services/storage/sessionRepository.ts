import type { SessionSummary } from '@/types/session';

/**
 * Local session history in IndexedDB. By default only a summary is stored (website, title, counts, status).
 * Answers are stored only when the user explicitly saves the application for later.
 */
const DB = 'formmate';
const STORE = 'sessions';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: 'id' });
        s.createIndex('updatedAt', 'updatedAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then((db) => new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = run(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); resolve(r.result); };
    t.onerror = () => { db.close(); reject(t.error); };
    t.onabort = () => { db.close(); reject(t.error); };
  }));
}

export const sessionIdFor = (url: string) => {
  try { const u = new URL(url); return `${u.hostname}${u.pathname}`.replace(/\/+$/, ''); } catch { return url; }
};

export async function saveSession(s: SessionSummary): Promise<void> { await tx('readwrite', (st) => st.put(s)); }
export async function getSession(id: string): Promise<SessionSummary | undefined> { return tx('readonly', (st) => st.get(id)) as Promise<SessionSummary | undefined>; }
export async function listSessions(): Promise<SessionSummary[]> {
  const all = (await tx('readonly', (st) => st.getAll())) as SessionSummary[];
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}
export async function deleteSession(id: string): Promise<void> { await tx('readwrite', (st) => st.delete(id)); }
export async function deleteAllSessions(): Promise<void> { await tx('readwrite', (st) => st.clear()); }
