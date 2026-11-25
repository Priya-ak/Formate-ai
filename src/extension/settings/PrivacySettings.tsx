import { useEffect, useState } from 'react';
import type { Settings } from '@/types/session';
import { AUTO_ORIGINS } from '@/utils/extensionApi';
import { clearProfile } from '@/services/storage/profileRepository';
import { deleteAllSessions, listSessions } from '@/services/storage/sessionRepository';
import { Button, Card, Toggle } from '@/components/ui';

export default function PrivacySettings({ s, update }: { s: Settings; update: (p: Partial<Settings>) => void }) {
  const [granted, setGranted] = useState(false);
  const [msg, setMsg] = useState('');
  const [count, setCount] = useState(0);
  const refresh = () => {
    void chrome.permissions.contains({ origins: AUTO_ORIGINS }).then(setGranted);
    void listSessions().then((l) => setCount(l.length)).catch(() => setCount(0));
  };
  useEffect(refresh, []);

  async function enableAuto() {
    // must run directly inside the click handler (user gesture)
    const ok = await chrome.permissions.request({ origins: AUTO_ORIGINS });
    if (!ok) { setMsg('Permission was not granted. FormMate will only detect forms when you click its icon (or on the local demo site).'); refresh(); return; }
    const r = await chrome.runtime.sendMessage({ type: 'FM_REGISTER_AUTO' }).catch(() => ({ ok: false }));
    await update({ autoDetect: true });
    setMsg(r?.ok === false ? 'Permission granted, but automatic detection could not be registered. Reload the extension.' : 'Automatic form detection is on for all websites.');
    refresh();
  }
  async function disableAuto() {
    await chrome.runtime.sendMessage({ type: 'FM_UNREGISTER_AUTO' }).catch(() => undefined);
    await chrome.permissions.remove({ origins: AUTO_ORIGINS }).catch(() => undefined);
    await update({ autoDetect: false });
    setMsg('Automatic detection is off. FormMate now works only when you click its icon.');
    refresh();
  }

  return (
    <Card className="space-y-2">
      <h2 className="text-lg font-bold">Privacy & permissions</h2>
      <ul className="fm-muted list-disc space-y-1 pl-5 text-xs text-slate-600">
        <li>No account, no FormMate server. Everything is stored in this browser.</li>
        <li>FormMate never submits forms, never fills password, one-time-code or payment fields, and never solves CAPTCHAs.</li>
        <li>Form contents are not sent anywhere unless you turn on optional AI below.</li>
      </ul>
      <div className="rounded-xl border border-slate-200 p-3">
        <p className="text-sm font-semibold">Automatic form detection on all websites: {granted ? 'On' : 'Off'}</p>
        <p className="fm-muted mb-2 text-xs text-slate-500">Off by default. Without it, FormMate reads a page only when you click its icon. Turning it on lets FormMate notice forms as you browse; it only looks at field labels on the page, and nothing leaves your browser.</p>
        {granted ? <Button onClick={() => void disableAuto()}>Turn off</Button> : <Button variant="primary" onClick={() => void enableAuto()}>Turn on…</Button>}
        {msg && <p role="status" className="mt-2 text-sm">{msg}</p>}
      </div>
      <Toggle label="Show the floating assistant on detected forms" checked={s.floatingAssistant} onChange={(v) => update({ floatingAssistant: v })} />
      <Toggle label="Confirm every answer before filling" checked={s.confirmEveryAnswer} onChange={(v) => update({ confirmEveryAnswer: v })} />
      <Toggle label="Keep a history of forms I filled (site, title, progress only)" hint="Answers are never kept unless you press “Save for later”." checked={s.saveHistory} onChange={(v) => update({ saveHistory: v })} />
      {s.disabledSites.length > 0 && (
        <div className="text-sm"><p className="font-medium">Sites where the assistant is hidden</p>
          <ul className="space-y-1">{s.disabledSites.map((h) => (
            <li key={h} className="flex items-center justify-between"><span>{h}</span><Button variant="ghost" onClick={() => update({ disabledSites: s.disabledSites.filter((x) => x !== h) })}>Remove</Button></li>
          ))}</ul>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <Button variant="danger" onClick={() => { if (confirm(`Delete ${count} saved history entries and any saved answers?`)) void deleteAllSessions().then(() => { setMsg('History deleted.'); refresh(); }); }}>Delete history ({count})</Button>
        <Button variant="danger" onClick={() => { if (confirm('Delete your profile, history and the AI key?')) void (async () => { await clearProfile(); await deleteAllSessions(); await update({ ai: { ...s.ai, apiKey: '', consent: false, provider: 'none' }, profileEnabled: false }); setMsg('All FormMate data deleted.'); refresh(); })(); }}>Delete all my data</Button>
      </div>
    </Card>
  );
}
