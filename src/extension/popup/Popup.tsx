import { useEffect, useState } from 'react';
import { Mic, List, Settings as Cog } from 'lucide-react';
import type { FormSchema } from '@/types/form';
import type { ContentCommand } from '@/types/session';
import { LANGUAGES, type LangCode } from '@/types/voice';
import { t as translate } from '@/services/i18n';
import { activeTab, isRestrictedUrl, openSidePanelForTab } from '@/utils/extensionApi';
import { useSettings } from '@/utils/useSettings';
import { Button, Card, Logo, Select, Toggle } from '@/components/ui';

async function ask<T>(tabId: number, cmd: ContentCommand): Promise<T | null> {
  try { return (await chrome.tabs.sendMessage(tabId, cmd)) as T; } catch { /* inject below */ }
  try {
    const r = await chrome.runtime.sendMessage({ type: 'FM_ENSURE_CONTENT', tabId });
    if (!r?.ok) return null;
    await new Promise((res) => setTimeout(res, 200));
    return (await chrome.tabs.sendMessage(tabId, cmd)) as T;
  } catch { return null; }
}

export default function Popup() {
  const { settings, update } = useSettings();
  const [tab, setTab] = useState<chrome.tabs.Tab>();
  const [schema, setSchema] = useState<FormSchema | null>(null);
  const [state, setState] = useState<'loading' | 'restricted' | 'unreachable' | 'ready'>('loading');
  const L = (k: string, v?: Record<string, string | number>) => translate(settings.uiLang, k, v);

  useEffect(() => {
    (async () => {
      const t = await activeTab();
      setTab(t);
      if (!t?.id || isRestrictedUrl(t.url)) { setState('restricted'); return; }
      const r = await ask<{ schema: FormSchema | null }>(t.id, { type: 'FM_SCAN', force: false });
      if (!r) { setState('unreachable'); return; }
      setSchema(r.schema);
      setState('ready');
    })();
  }, []);

  const host = (() => { try { return new URL(tab?.url || '').hostname; } catch { return ''; } })();
  const disabledHere = !!host && settings.disabledSites.includes(host);
  const fieldCount = schema?.fields.filter((f) => !f.disabled && !f.readOnly).length ?? 0;

  async function open(mode: 'start' | 'review') {
    if (!tab?.id) return;
    const r = await openSidePanelForTab(tab.id, { autostart: mode === 'start', mode, at: Date.now() });
    if (r.ok) window.close();
  }

  return (
    <main className="w-[340px] space-y-3 p-3" data-testid="popup">
      <header className="flex items-center justify-between">
        <Logo />
        <Button variant="ghost" aria-label={L('ui.settings')} onClick={() => { void chrome.runtime.openOptionsPage(); window.close(); }}><Cog className="h-4 w-4" aria-hidden /></Button>
      </header>
      <Card className="space-y-2 text-center">
        {state === 'loading' && <p className="text-sm">…</p>}
        {state === 'restricted' && <p className="text-sm">FormMate cannot work on browser pages. Open a website with a form.</p>}
        {state === 'unreachable' && <p className="text-sm">I cannot read this page. Try reloading it, then open FormMate again.</p>}
        {state === 'ready' && !schema && <p className="text-sm font-medium" data-testid="popup-no-form">{L('ui.noForm')}</p>}
        {state === 'ready' && schema && (
          <>
            <p className="font-semibold">{L('ui.formDetected')}</p>
            <p className="text-xs text-slate-500 fm-muted">{schema.title} · {L('ui.fieldsFound', { n: fieldCount })}</p>
            <Button variant="primary" className="w-full !py-3" onClick={() => void open('start')}><Mic className="h-5 w-5" aria-hidden />{L('ui.start')}</Button>
            <Button variant="ghost" className="w-full" onClick={() => void open('review')}><List className="h-4 w-4" aria-hidden />{L('ui.reviewFields')}</Button>
          </>
        )}
      </Card>
      <Card className="!p-3">
        <Select<LangCode> label={L('ui.assistantLang')} value={settings.assistantLang} onChange={(v) => void update({ assistantLang: v, uiLang: v })} options={LANGUAGES.map((l) => ({ value: l.code, label: `${l.native} (${l.label})` }))} />
        <Select<LangCode> label={L('ui.answerLang')} value={settings.answerLang} onChange={(v) => void update({ answerLang: v })} options={LANGUAGES.map((l) => ({ value: l.code, label: l.native }))} />
        {host && (
          <Toggle label={`Show assistant on ${host}`} checked={!disabledHere}
            onChange={(on) => void update({ disabledSites: on ? settings.disabledSites.filter((h) => h !== host) : [...settings.disabledSites, host] })} />
        )}
      </Card>
      <p className="text-center text-xs text-slate-500 fm-muted">FormMate never submits a form for you.</p>
    </main>
  );
}
