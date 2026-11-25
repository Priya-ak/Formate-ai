import type { DetectionSummary } from '@/types/session';

const key = (tabId: number) => `fm.tab.${tabId}`;

export async function setSummary(tabId: number, s: DetectionSummary): Promise<void> {
  await chrome.storage.session.set({ [key(tabId)]: s });
  if (s.hasForm && s.fieldCount > 0) {
    await chrome.action.setBadgeBackgroundColor({ tabId, color: '#16A34A' });
    await chrome.action.setBadgeText({ tabId, text: String(Math.min(s.fieldCount, 99)) });
  } else {
    await chrome.action.setBadgeText({ tabId, text: '' });
  }
}

export async function getSummary(tabId: number): Promise<DetectionSummary | null> {
  const r = await chrome.storage.session.get(key(tabId));
  return (r[key(tabId)] as DetectionSummary | undefined) ?? null;
}

export async function clearTab(tabId: number): Promise<void> {
  await chrome.storage.session.remove(key(tabId));
  try { await chrome.action.setBadgeText({ tabId, text: '' }); } catch { /* tab may be gone */ }
}
