/**
 * Key/value storage on top of chrome.storage.local, with an in-memory fallback so the same code
 * runs in unit tests and plain pages. Nothing here ever leaves the user's browser.
 */
export interface KV {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

class MemoryKV implements KV {
  private m = new Map<string, unknown>();
  async get<T>(k: string) { return this.m.get(k) as T | undefined; }
  async set<T>(k: string, v: T) { this.m.set(k, JSON.parse(JSON.stringify(v))); }
  async remove(k: string) { this.m.delete(k); }
  async clear() { this.m.clear(); }
}

class ChromeKV implements KV {
  async get<T>(k: string) { const r = await chrome.storage.local.get(k); return r[k] as T | undefined; }
  async set<T>(k: string, v: T) { await chrome.storage.local.set({ [k]: v }); }
  async remove(k: string) { await chrome.storage.local.remove(k); }
  async clear() { await chrome.storage.local.clear(); }
}

let store: KV | null = null;
export function getStore(): KV {
  if (!store) store = typeof chrome !== 'undefined' && chrome.storage?.local ? new ChromeKV() : new MemoryKV();
  return store;
}
export function setStoreForTests(kv: KV | null) { store = kv; }
export function createMemoryStore(): KV { return new MemoryKV(); }

import { DEFAULT_SETTINGS, type Settings } from '@/types/session';

const SETTINGS_KEY = 'fm.settings';

export async function loadSettings(): Promise<Settings> {
  const saved = await getStore().get<Partial<Settings>>(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(saved || {}), ai: { ...DEFAULT_SETTINGS.ai, ...(saved?.ai || {}) } };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const cur = await loadSettings();
  const next: Settings = { ...cur, ...patch, ai: { ...cur.ai, ...(patch.ai || {}) } };
  await getStore().set(SETTINGS_KEY, next);
  return next;
}

export function onSettingsChanged(cb: (s: Settings) => void): () => void {
  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return () => undefined;
  const h = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && changes[SETTINGS_KEY]) {
      const v = changes[SETTINGS_KEY].newValue as Partial<Settings> | undefined;
      cb({ ...DEFAULT_SETTINGS, ...(v || {}), ai: { ...DEFAULT_SETTINGS.ai, ...(v?.ai || {}) } });
    }
  };
  chrome.storage.onChanged.addListener(h);
  return () => chrome.storage.onChanged.removeListener(h);
}
