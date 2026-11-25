import { LANGUAGES, type LangCode } from '@/types/voice';
import type { Settings } from '@/types/session';
import { Card, Select, Toggle } from '@/components/ui';

export default function LanguageSettings({ s, update }: { s: Settings; update: (p: Partial<Settings>) => void }) {
  const opts = LANGUAGES.map((l) => ({ value: l.code, label: `${l.native} (${l.label})` }));
  return (
    <Card className="space-y-1">
      <h2 className="text-lg font-bold">Language & voice</h2>
      <Select<LangCode> label="Assistant language (questions and screen text)" value={s.assistantLang} onChange={(v) => update({ assistantLang: v, uiLang: v })} options={opts} />
      <Select<LangCode> label="Answer language (the language you speak)" value={s.answerLang} onChange={(v) => update({ answerLang: v })} options={opts} />
      <p className="fm-muted text-xs text-slate-500">All eight languages are translated on screen and in the conversation. Voice recognition and speech depend on languages your browser and operating system support.</p>
      <Toggle label="Speak questions aloud" checked={s.speakQuestions} onChange={(v) => update({ speakQuestions: v })} />
      <Toggle label="Listen automatically after each question" checked={s.autoListen} onChange={(v) => update({ autoListen: v })} />
      <Toggle label="Slow speech" checked={s.slowSpeech} onChange={(v) => update({ slowSpeech: v })} />
      <label className="block py-1 text-sm font-medium">Speech speed: {s.speechRate.toFixed(1)}×
        <input type="range" min={0.5} max={1.5} step={0.1} value={s.speechRate} onChange={(e) => update({ speechRate: Number(e.target.value) })} className="w-full accent-[#5B5CE2]" />
      </label>
    </Card>
  );
}
