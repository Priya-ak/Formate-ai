import type { BackgroundRequest } from '@/types/session';
import { loadSettings } from '@/services/storage/localStorageRepository';
import { GeminiProvider } from '@/services/ai/geminiProvider';
import { canUseAI } from '@/services/ai/aiProvider';
import { AUTO_ORIGINS, openSidePanelForTab, takePending } from '@/utils/extensionApi';
import { clearTab, getSummary, setSummary } from './tabManager';

const AUTO_ID = 'fm-auto';
let gemini: { sig: string; p: GeminiProvider } | null = null;

export async function registerAutoDetection(): Promise<{ ok: boolean; error?: string }> {
  const granted = await chrome.permissions.contains({ origins: AUTO_ORIGINS });
  if (!granted) return { ok: false, error: 'Permission to read pages was not granted.' };
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [AUTO_ID] });
  if (!existing.length) {
    await chrome.scripting.registerContentScripts([{
      id: AUTO_ID, matches: AUTO_ORIGINS, js: ['content.js'], runAt: 'document_idle', persistAcrossSessions: true, allFrames: false,
    }]);
  }
  return { ok: true };
}

export async function unregisterAutoDetection(): Promise<void> {
  try { await chrome.scripting.unregisterContentScripts({ ids: [AUTO_ID] }); } catch { /* not registered */ }
  try { await chrome.permissions.remove({ origins: AUTO_ORIGINS }); } catch { /* ignore */ }
}

async function aiExtract(req: Extract<BackgroundRequest, { type: 'FM_AI_EXTRACT' }>['request']) {
  const settings = await loadSettings();
  if (!canUseAI(settings.ai, { semanticType: req.field.semanticType, sensitive: false, manualOnly: false })) {
    return { error: 'The optional AI is off, has no key, or you have not given consent.' };
  }
  const sig = `${settings.ai.apiKey.length}:${settings.ai.model}`;
  if (!gemini || gemini.sig !== sig) gemini = { sig, p: new GeminiProvider(settings.ai) };
  try { return { result: await gemini.p.extract(req) }; }
  catch (e) { return { error: e instanceof Error ? e.message : 'AI request failed.' }; }
}

/** Handles messages from our own extension pages and content scripts. Returns true when answering asynchronously. */
export function routeMessage(
  msg: BackgroundRequest | { type: string }, sender: chrome.runtime.MessageSender, respond: (r: unknown) => void,
): boolean {
  if (sender.id !== chrome.runtime.id || !msg || typeof msg.type !== 'string') return false;
  const m = msg as BackgroundRequest & { summary?: never };

  switch (m.type) {
    case 'FM_OPEN_SIDEPANEL': {
      const tabId = sender.tab?.id;
      if (tabId === undefined) { respond({ ok: false, error: 'No tab.' }); return false; }
      openSidePanelForTab(tabId, { autostart: !!m.autostart, mode: m.mode ?? 'start', at: Date.now() }).then(respond);
      return true;
    }
    case 'FM_TAKE_PENDING': takePending(m.tabId).then((p) => respond({ pending: p })); return true;
    case 'FM_GET_TAB_STATE': getSummary(m.tabId).then((s) => respond({ summary: s })); return true;
    case 'FM_AI_EXTRACT': aiExtract(m.request).then(respond); return true;
    case 'FM_ENSURE_CONTENT':
      chrome.scripting.executeScript({ target: { tabId: m.tabId }, files: ['content.js'] })
        .then(() => respond({ ok: true }), (e) => respond({ ok: false, error: String(e?.message || e) }));
      return true;
    case 'FM_REGISTER_AUTO': registerAutoDetection().then(respond, (e) => respond({ ok: false, error: String(e) })); return true;
    case 'FM_UNREGISTER_AUTO': unregisterAutoDetection().then(() => respond({ ok: true })); return true;
    default: break;
  }

  const raw = msg as { type: string; summary?: import('@/types/session').DetectionSummary };
  if (raw.type === 'FM_FORM_DETECTED' && sender.tab?.id !== undefined && raw.summary) {
    setSummary(sender.tab.id, raw.summary).then(() => respond({ ok: true }), () => respond({ ok: false }));
    return true;
  }
  return false;
}

export { clearTab };
