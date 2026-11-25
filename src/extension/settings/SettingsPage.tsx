import { useState } from 'react';
import type { Settings } from '@/types/session';
import { useSettings } from '@/utils/useSettings';
import { Button, Card, Logo, Select, TextInput, Toggle } from '@/components/ui';
import LanguageSettings from './LanguageSettings';
import ProfileSettings from './ProfileSettings';
import PrivacySettings from './PrivacySettings';

export default function SettingsPage() {
  const { settings: s, update, ready } = useSettings();
  const [key, setKey] = useState('');
  const [testMsg, setTestMsg] = useState('');
  const [testing, setTesting] = useState(false);
  if (!ready) return null;
  const up = (p: Partial<Settings>) => void update(p);

  async function testKey() {
    setTesting(true); setTestMsg('');
    const r = await chrome.runtime.sendMessage({
      type: 'FM_AI_EXTRACT',
      request: { field: { fieldId: 'test', label: 'Job role you are applying for', semanticType: 'job_role', inputType: 'text', required: true, options: [] }, userAnswer: 'I want to apply for the software developer position', answerLanguage: 'en', mode: 'extract' },
    }).catch(() => null);
    setTesting(false);
    setTestMsg(r?.result ? `✔ Gemini responded (“${String(r.result.extractedValue)}”).` : `Could not reach Gemini: ${r?.error || 'no response'}. FormMate will keep using built-in understanding.`);
  }

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6" data-testid="settings">
      <header><Logo size={34} /><p className="fm-muted mt-1 text-sm text-slate-600">Voice-guided form filling. You stay in control: FormMate never submits a form.</p></header>
      <LanguageSettings s={s} update={up} />

      <Card className="space-y-1">
        <h2 className="text-lg font-bold">Accessibility</h2>
        <Toggle label="Easy Mode" hint="Larger text, one question at a time, confirms every answer." checked={s.easyMode} onChange={(v) => up({ easyMode: v, confirmEveryAnswer: v ? true : s.confirmEveryAnswer })} />
        <Toggle label="High contrast" checked={s.highContrast} onChange={(v) => up({ highContrast: v })} />
        <Toggle label="Reduce motion" checked={s.reducedMotion} onChange={(v) => up({ reducedMotion: v })} />
        <Select<Settings['textSize']> label="Text size" value={s.textSize} onChange={(v) => up({ textSize: v })} options={[{ value: 'normal', label: 'Normal' }, { value: 'large', label: 'Large' }, { value: 'xlarge', label: 'Extra large' }]} />
      </Card>

      <ProfileSettings s={s} update={up} />
      <PrivacySettings s={s} update={up} />

      <Card className="space-y-2">
        <h2 className="text-lg font-bold">Optional AI (Gemini)</h2>
        <p className="fm-muted text-xs text-slate-600">FormMate works fully without AI. If you add your own free Gemini API key, it is used only to understand harder answers (for example free-form text in another language). Get a key at aistudio.google.com. The key is stored only in this browser and used only by FormMate’s background worker.</p>
        <Toggle label="Use Gemini" checked={s.ai.provider === 'gemini'} onChange={(v) => up({ ai: { ...s.ai, provider: v ? 'gemini' : 'none' } })} />
        {s.ai.provider === 'gemini' && (
          <>
            <TextInput label="Gemini API key" type="password" value={key} onChange={setKey} placeholder={s.ai.apiKey ? '•••••••• (saved — type to replace)' : 'Paste your key'} autoComplete="off" />
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" disabled={!key.trim()} onClick={() => { up({ ai: { ...s.ai, apiKey: key.trim() } }); setKey(''); setTestMsg('Key saved.'); }}>Save key</Button>
              {s.ai.apiKey && <Button variant="danger" onClick={() => { up({ ai: { ...s.ai, apiKey: '' } }); setTestMsg('Key removed.'); }}>Remove key</Button>}
              {s.ai.apiKey && <Button disabled={testing || !s.ai.consent} onClick={() => void testKey()}>{testing ? 'Testing…' : 'Test connection'}</Button>}
            </div>
            <TextInput label="Model" value={s.ai.model} onChange={(v) => up({ ai: { ...s.ai, model: v.trim() || 'gemini-2.0-flash' } })} />
            <Toggle label="I agree that answers to non-sensitive questions may be sent to Google’s Gemini service" hint="Names, emails, phone numbers, dates of birth, IDs and other sensitive fields are never sent. Required for AI to run." checked={s.ai.consent} onChange={(v) => up({ ai: { ...s.ai, consent: v } })} />
            <Toggle label="Let AI rewrite long answers in clear English (always confirmed by you)" checked={s.ai.rewrite === 'polish'} onChange={(v) => up({ ai: { ...s.ai, rewrite: v ? 'polish' : 'preserve' } })} />
            {testMsg && <p role="status" className="text-sm">{testMsg}</p>}
          </>
        )}
      </Card>
    </main>
  );
}
