import type { PendingStart } from '@/types/session';

const pendingKey = (tabId: number) => `fm.pending.${tabId}`;

export async function setPending(tabId: number, p: PendingStart): Promise<void> {
  await chrome.storage.session.set({ [pendingKey(tabId)]: p });
}

export async function takePending(tabId: number): Promise<PendingStart | null> {
  const k = pendingKey(tabId);
  const r = await chrome.storage.session.get(k);
  const p = (r[k] as PendingStart | undefined) ?? null;
  if (p) await chrome.storage.session.remove(k);
  // stale requests (older than 2 minutes) are ignored
  return p && Date.now() - p.at < 120000 ? p : null;
}

/**
 * Opens FormMate's side panel for a tab. Must run inside a user gesture (button click / message from one).
 * Falls back to a small popup window in browsers without the Side Panel API.
 */
export async function openSidePanelForTab(tabId: number, pending?: PendingStart): Promise<{ ok: boolean; error?: string }> {
  try {
    const tasks: Promise<unknown>[] = [];
    if (chrome.sidePanel?.open) tasks.push(chrome.sidePanel.open({ tabId }));
    else tasks.push(chrome.windows.create({ url: chrome.runtime.getURL(`sidepanel.html?tabId=${tabId}`), type: 'popup', width: 440, height: 760 }));
    if (pending) tasks.push(setPending(tabId, pending));
    await Promise.all(tasks);
    if (pending) chrome.runtime.sendMessage({ type: 'FM_PENDING_START', tabId }).catch(() => undefined);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not open the side panel.' };
  }
}

export async function activeTab(): Promise<chrome.tabs.Tab | undefined> {
  const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return t;
}

export const AUTO_ORIGINS = ['http://*/*', 'https://*/*'];

export function isRestrictedUrl(url?: string): boolean {
  return !url || /^(chrome|edge|about|chrome-extension|moz-extension|devtools|view-source):/i.test(url) || /^https:\/\/(chrome\.google\.com\/webstore|chromewebstore\.google\.com|microsoftedge\.microsoft\.com\/addons)/i.test(url);
}
