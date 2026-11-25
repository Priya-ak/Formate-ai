import type { ContentCommand, ContentEvent, Settings } from '@/types/session';
import { DEFAULT_SETTINGS } from '@/types/session';
import { loadSettings, onSettingsChanged } from '@/services/storage/localStorageRepository';
import { readValue } from '@/services/form/automation';
import { FormWatcher } from './formDetector';
import { FormAutomation } from './formAutomation';
import { FloatingAssistant } from './floatingAssistant';
import { isSiteDisabled, markDismissed, prefersReducedMotion, wasDismissed } from './pageContext';
import { debounce } from '@/utils/text';

declare global { interface Window { __formmateLoaded?: boolean } }

function send(ev: ContentEvent) {
  try { void chrome.runtime.sendMessage(ev).catch(() => undefined); } catch { /* extension reloaded */ }
}

async function request(msg: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await chrome.runtime.sendMessage(msg);
    return r ?? { ok: false, error: 'No answer from FormMate.' };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'FormMate is not reachable.' }; }
}

async function main() {
  if (window.top !== window || window.__formmateLoaded) return;
  window.__formmateLoaded = true;

  let settings: Settings = DEFAULT_SETTINGS;
  try { settings = await loadSettings(); } catch { /* use defaults */ }

  const watcher = new FormWatcher();
  const automation = new FormAutomation(watcher);
  automation.setReducedMotion(prefersReducedMotion(settings));
  let started = false;
  let announced = false;

  const fab = new FloatingAssistant({
    getLang: () => settings.assistantLang,
    onStart: () => request({ type: 'FM_OPEN_SIDEPANEL', autostart: true, mode: 'start' }),
    onReview: () => request({ type: 'FM_OPEN_SIDEPANEL', autostart: false, mode: 'review' }),
    onOpen: () => request({ type: 'FM_OPEN_SIDEPANEL', autostart: false, mode: 'start' }),
    onDismiss: () => markDismissed(),
  });

  const disabled = () => isSiteDisabled(settings);

  const announce = (n: number, title: string, kind: string) => {
    send({ type: 'FM_FORM_DETECTED', summary: { hasForm: n > 0, fieldCount: n, title, host: location.hostname, kind: kind as never } });
  };

  const ensureStarted = () => {
    if (started) return;
    started = true;
    watcher.onChange((schema, reason) => {
      const n = schema?.fields.filter((f) => !f.disabled && !f.readOnly).length ?? 0;
      fab.setFieldCount(n);
      announce(n, schema?.title ?? '', schema?.kind ?? 'other');
      send({ type: 'FM_SCHEMA_CHANGED', schema, reason });
      if (n > 0 && !announced && settings.autoDetect && settings.floatingAssistant && !disabled() && !wasDismissed()) {
        announced = true;
        fab.showCard();
      }
    });
    watcher.start();
    // Track edits made by the person themselves so progress stays in sync (programmatic fills are untrusted events).
    const edited = new Map<string, ReturnType<typeof debounce>>();
    const onUserEdit = (e: Event) => {
      if (!e.isTrusted) return;
      const res = watcher.result;
      const target = e.target as Element | null;
      if (!res || !target) return;
      for (const [id, ref] of res.refs) {
        if (ref.el === target || ref.group?.includes(target as HTMLInputElement)) {
          const f = res.schema.fields.find((x) => x.fieldId === id);
          if (!f || f.manualOnly) return;
          let d = edited.get(id);
          if (!d) { d = debounce(() => send({ type: 'FM_FIELD_EDITED', fieldId: id, value: readValue(ref, f.inputType) }), 700); edited.set(id, d); }
          d();
          return;
        }
      }
    };
    document.addEventListener('input', onUserEdit, true);
    document.addEventListener('change', onUserEdit, true);
  };

  const applySettings = () => {
    automation.setReducedMotion(prefersReducedMotion(settings));
    fab.setVisible(settings.floatingAssistant && !disabled());
  };

  await fab.mount();
  applySettings();
  onSettingsChanged((s) => { settings = s; applySettings(); if (!disabled() && !started) ensureStarted(); });

  if (!disabled()) ensureStarted();

  chrome.runtime.onMessage.addListener((msg: ContentCommand, _sender, sendResponse) => {
    if (!msg || typeof msg.type !== 'string' || !msg.type.startsWith('FM_')) return false;
    const cmds = ['FM_PING', 'FM_SCAN', 'FM_FILL', 'FM_HIGHLIGHT', 'FM_CLEAR_HIGHLIGHT', 'FM_READ_VALUES', 'FM_SHOW_NOTICE'];
    if (!cmds.includes(msg.type)) return false;
    ensureStarted(); // an explicit request from the person works even on sites where auto-detection is off
    automation.handle(msg).then(sendResponse, (e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  });
}

void main();
