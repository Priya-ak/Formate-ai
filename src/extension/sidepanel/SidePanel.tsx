import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Settings as Cog, Pause, Play, Square, HelpCircle, Send, List, Check, Pencil, Mic, Sparkles } from 'lucide-react';
import type { FormSchema } from '@/types/form';
import type { ContentCommand, ContentEvent, SessionSummary, UserProfile } from '@/types/session';
import { EMPTY_PROFILE } from '@/types/session';
import { LANGUAGES, type LangCode, type RecognitionErrorCode, type VoiceStatus } from '@/types/voice';
import { ConversationEngine, type EngineHost, type EngineState } from '@/services/ai/conversationEngine';
import { RemoteAIProvider, explainField, extractSmart } from '@/services/ai/extractionService';
import { VoiceManager } from '@/services/voice/voiceManager';
import { loadProfile } from '@/services/storage/profileRepository';
import { getSession, saveSession, sessionIdFor } from '@/services/storage/sessionRepository';
import { t as translate } from '@/services/i18n';
import { isRestrictedUrl, takePending } from '@/utils/extensionApi';
import { useSettings } from '@/utils/useSettings';
import { sleep } from '@/utils/text';
import { Button, Card, Logo, Pill, Select } from '@/components/ui';
import VoiceAssistant from './components/VoiceAssistant';
import CurrentQuestion from './components/CurrentQuestion';
import Transcript from './components/Transcript';
import FormProgress from './components/FormProgress';
import FieldReview from './components/FieldReview';
import FormSummary from './components/FormSummary';

type Notice = { kind: 'info' | 'warn' | 'error'; text: string; action?: { label: string; run: () => void } };

async function sendToTab<T>(tabId: number, cmd: ContentCommand): Promise<T | null> {
  try { return (await chrome.tabs.sendMessage(tabId, cmd)) as T; } catch { /* content script missing: inject once */ }
  try {
    const r = await chrome.runtime.sendMessage({ type: 'FM_ENSURE_CONTENT', tabId });
    if (!r?.ok) return null;
    await sleep(200);
    return (await chrome.tabs.sendMessage(tabId, cmd)) as T;
  } catch { return null; }
}

const fixedTabId = (() => { const v = new URLSearchParams(location.search).get('tabId'); return v ? Number(v) : null; })();

export default function SidePanel() {
  const { settings, update, ready } = useSettings();
  const [tabId, setTabId] = useState<number | null>(fixedTabId);
  const [tabUrl, setTabUrl] = useState('');
  const [schema, setSchema] = useState<FormSchema | null>(null);
  const [state, setState] = useState<EngineState | null>(null);
  const [view, setView] = useState<'main' | 'fields'>('main');
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
  const [interim, setInterim] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [typed, setTyped] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [savedSession, setSavedSession] = useState<SessionSummary | null>(null);
  const [savedNow, setSavedNow] = useState(false);
  const [scanning, setScanning] = useState(false);
  const textRef = useRef<HTMLInputElement>(null);

  const engines = useRef(new Map<number, ConversationEngine>());
  const unsub = useRef<(() => void) | null>(null);
  const settingsRef = useRef(settings); settingsRef.current = settings;
  const tabRef = useRef<number | null>(tabId); tabRef.current = tabId;
  const stateRef = useRef<EngineState | null>(null); stateRef.current = state;
  const profileRef = useRef(profile); profileRef.current = profile;
  const retries = useRef(0);
  const micBlocked = useRef(false);
  const warnedVoice = useRef(new Set<string>());
  const speakToken = useRef(0);

  const lang: LangCode = settings.uiLang;
  const L = useCallback((k: string, v?: Record<string, string | number>) => translate(settingsRef.current.uiLang, k, v), []);
  const remoteAI = useMemo(() => new RemoteAIProvider(), []);

  // ---------- voice ----------
  const voice = useMemo(() => new VoiceManager({
    onStatus: setVoiceStatus,
    onInterim: setInterim,
    onFinal: (text) => { retries.current = 0; setInterim(''); if (stateRef.current) void engineFor(tabRef.current)?.submitAnswer(text); },
    onError: (code: RecognitionErrorCode) => handleVoiceError(code),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);
  const caps = useMemo(() => voice.capabilities(), [voice]);

  function handleVoiceError(code: RecognitionErrorCode) {
    if (code === 'aborted') return;
    if (code === 'no-speech') {
      retries.current += 1;
      if (retries.current < 2) { window.setTimeout(maybeListen, 300); return; }
      setNotice({ kind: 'info', text: 'I did not hear anything. Tap the microphone to try again, or type your answer.' });
      return;
    }
    if (code === 'not-allowed' || code === 'service-not-allowed') {
      micBlocked.current = true;
      setNotice({ kind: 'error', text: L('ui.micDenied'), action: { label: 'Allow microphone', run: () => { micBlocked.current = false; void chrome.tabs.create({ url: chrome.runtime.getURL('permission.html') }); } } });
      return;
    }
    if (code === 'network') { setNotice({ kind: 'warn', text: 'Speech recognition needs an internet connection in this browser. You can type your answers instead.' }); return; }
    if (code === 'audio-capture') { setNotice({ kind: 'error', text: 'No microphone was found. Connect one, or type your answers.' }); return; }
    if (code === 'language-not-supported') { setNotice({ kind: 'warn', text: 'This browser cannot recognise that language by voice. Type your answers, or pick another language.' }); return; }
    setNotice({ kind: 'warn', text: 'Voice input had a problem. You can type your answers instead.' });
  }

  function maybeListen() {
    const s = stateRef.current;
    const st = settingsRef.current;
    if (!s || !st.autoListen || micBlocked.current || !caps.recognition || s.busy) return;
    if (!['asking', 'confirming', 'profile_offer'].includes(s.phase) || s.isNotice) return;
    voice.listen(st.answerLang);
  }

  // ---------- engine management ----------
  function engineFor(id: number | null) { return id === null ? undefined : engines.current.get(id); }

  const makeHost = useCallback((id: number): EngineHost => ({
    fill: async (fieldId, value) => (await sendToTab(id, { type: 'FM_FILL', fieldId, value })) ?? { ok: false, fieldId, error: 'I lost contact with the page. Reload it and try again.' },
    highlight: (fieldId, scroll) => { void sendToTab(id, { type: 'FM_HIGHLIGHT', fieldId, scroll }); },
    clearHighlight: () => { void sendToTab(id, { type: 'FM_CLEAR_HIGHLIGHT' }); },
    extract: (field, text) => extractSmart(field, text, settingsRef.current.answerLang, settingsRef.current.ai, settingsRef.current.ai.provider === 'gemini' ? remoteAI : null),
    explain: (field) => explainField(field, settingsRef.current.answerLang, settingsRef.current.ai, settingsRef.current.ai.provider === 'gemini' ? remoteAI : null),
  }), [remoteAI]);

  const attach = useCallback((id: number) => {
    unsub.current?.();
    const e = engines.current.get(id);
    unsub.current = e ? e.subscribe(setState) : null;
    if (!e) setState(null);
  }, []);

  const applySchema = useCallback((id: number, sc: FormSchema | null, reason: 'mutation' | 'navigation' | 'step' | 'initial') => {
    if (tabRef.current !== id) return;
    setSchema(sc);
    if (!sc) { return; }
    const st = settingsRef.current;
    let e = engines.current.get(id);
    if (!e) {
      e = new ConversationEngine(makeHost(id), {
        assistantLang: st.assistantLang, confirmEveryAnswer: st.confirmEveryAnswer || st.easyMode,
        profile: profileRef.current, profileEnabled: st.profileEnabled, aiAvailable: st.ai.provider === 'gemini' && st.ai.consent && !!st.ai.apiKey,
      });
      engines.current.set(id, e);
      e.load(sc);
      attach(id);
    } else {
      if (e.getState().phase === 'idle') e.load(sc); else e.updateSchema(sc, reason);
    }
  }, [attach, makeHost]);

  const scan = useCallback(async (id: number, force = false) => {
    setScanning(true);
    const res = await sendToTab<{ schema: FormSchema | null }>(id, { type: 'FM_SCAN', force });
    setScanning(false);
    if (!res) {
      const tab = await chrome.tabs.get(id).catch(() => null);
      setNotice(isRestrictedUrl(tab?.url)
        ? { kind: 'info', text: 'FormMate cannot work on browser pages like this one. Open a website with a form.' }
        : { kind: 'warn', text: 'I cannot read this page yet. Click the FormMate toolbar icon on the page, then try again.' });
      setSchema(null);
      return;
    }
    applySchema(id, res.schema, 'initial');
    if (res.schema) {
      const s = await getSession(sessionIdFor(res.schema.url)).catch(() => undefined);
      setSavedSession(s?.savedAnswers ? s : null);
    }
  }, [applySchema]);

  // ---------- tab tracking ----------
  useEffect(() => {
    let alive = true;
    const resolve = async () => {
      if (fixedTabId !== null) { setTabId(fixedTabId); return; }
      const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (alive && t?.id !== undefined) setTabId(t.id);
    };
    void resolve();
    const onAct = () => { void resolve(); };
    const onUpd = (id: number, info: chrome.tabs.TabChangeInfo) => { if (id === tabRef.current && info.status === 'complete') { setNotice(null); void scan(id); } };
    chrome.tabs.onActivated.addListener(onAct);
    chrome.tabs.onUpdated.addListener(onUpd);
    return () => { alive = false; chrome.tabs.onActivated.removeListener(onAct); chrome.tabs.onUpdated.removeListener(onUpd); };
  }, [scan]);

  useEffect(() => { void loadProfile().then(setProfile); }, []);

  useEffect(() => {
    if (tabId === null || !ready) return;
    voice.cancelAll();
    setNotice(null); setView('main'); setSavedNow(false); setInterim('');
    chrome.tabs.get(tabId).then((t) => setTabUrl(t.url || '')).catch(() => undefined);
    setSchema(engines.current.get(tabId)?.getState().fields.length ? schema : null);
    attach(tabId);
    void scan(tabId).then(async () => {
      const p = await takePending(tabId);
      if (p?.autostart) start();
      else if (p?.mode === 'review') setView('fields');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId, ready]);

  // events from the page and the background worker
  useEffect(() => {
    const h = (msg: ContentEvent | { type: 'FM_PENDING_START'; tabId: number }, sender: chrome.runtime.MessageSender) => {
      if (msg.type === 'FM_PENDING_START') {
        if (msg.tabId === tabRef.current) void takePending(msg.tabId).then((p) => { if (p?.autostart) start(); else if (p?.mode === 'review') setView('fields'); });
        return;
      }
      if (sender.tab?.id !== tabRef.current || tabRef.current === null) return;
      const e = engineFor(tabRef.current);
      if (msg.type === 'FM_SCHEMA_CHANGED') { if (msg.schema) applySchema(tabRef.current, msg.schema, msg.reason); else setSchema(null); }
      if (msg.type === 'FM_FIELD_EDITED' && e) e.noteManualEdit(msg.fieldId, msg.value);
    };
    chrome.runtime.onMessage.addListener(h as Parameters<typeof chrome.runtime.onMessage.addListener>[0]);
    return () => chrome.runtime.onMessage.removeListener(h as Parameters<typeof chrome.runtime.onMessage.addListener>[0]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applySchema]);

  // keep engine options in sync with settings/profile
  useEffect(() => {
    engineFor(tabId)?.setOptions({
      assistantLang: settings.assistantLang, confirmEveryAnswer: settings.confirmEveryAnswer || settings.easyMode,
      profile, profileEnabled: settings.profileEnabled, aiAvailable: settings.ai.provider === 'gemini' && settings.ai.consent && !!settings.ai.apiKey,
    });
  }, [settings, profile, tabId]);

  // ---------- speak each assistant message once ----------
  useEffect(() => {
    if (!state || !state.messageSeq) return;
    const token = ++speakToken.current;
    const st = settingsRef.current;
    (async () => {
      if (st.speakQuestions && caps.synthesis) {
        if (!(await voice.hasVoiceFor(state.messageLang)) && !warnedVoice.current.has(state.messageLang)) {
          warnedVoice.current.add(state.messageLang);
          setNotice({ kind: 'info', text: L('ui.noVoiceOut') });
        } else {
          const rate = (st.slowSpeech || state.wantsSlower ? 0.75 : 1) * st.speechRate;
          await voice.speak(state.message, state.messageLang, { rate, voiceName: st.voiceName || undefined });
        }
      }
      if (token !== speakToken.current) return;
      maybeListen();
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.messageSeq]);

  // ---------- history (summary only unless saved on purpose) ----------
  useEffect(() => {
    if (!state || !schema || !settings.saveHistory || state.phase === 'idle') return;
    const id = sessionIdFor(schema.url);
    const status = state.phase === 'review' ? 'completed' : state.phase === 'paused' ? 'paused' : 'in_progress';
    void saveSession({
      id, host: schema.host, title: schema.title, url: schema.url, updatedAt: Date.now(),
      filled: state.progress.done, total: state.progress.total, status, savedAnswers: savedSession?.savedAnswers,
    }).catch(() => undefined);
  }, [state?.progress.done, state?.phase, schema?.url, settings.saveHistory]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- actions ----------
  function start() {
    const id = tabRef.current;
    const e = engineFor(id);
    if (!e) return;
    retries.current = 0; micBlocked.current = false; setNotice(null); setView('main');
    if (!caps.recognition) setNotice({ kind: 'info', text: L('ui.noSpeech') });
    e.start();
    if (schema?.unsupportedCount) void sendToTab(id!, { type: 'FM_SHOW_NOTICE', text: L('ui.manualNotice') });
  }

  async function resumeSaved() {
    const id = tabRef.current; const e = engineFor(id);
    if (!id || !e || !savedSession?.savedAnswers || !schema) return;
    const host = makeHost(id);
    for (const f of schema.fields) {
      const v = savedSession.savedAnswers[f.key];
      if (v === undefined || f.manualOnly || f.inputType === 'file' || f.disabled || f.readOnly) continue;
      const r = await host.fill(f.fieldId, v);
      if (r.ok) e.noteManualEdit(f.fieldId, v);
    }
    start();
  }

  function saveForLater() {
    if (!schema || !state) return;
    const answers: Record<string, string | string[] | boolean> = {};
    state.fields.forEach((f) => {
      if (f.status !== 'filled' && f.status !== 'confirmed') return;
      if (f.manualOnly || f.sensitive || f.inputType === 'file') return;
      answers[f.key] = f.value;
    });
    const s: SessionSummary = { id: sessionIdFor(schema.url), host: schema.host, title: schema.title, url: schema.url, updatedAt: Date.now(), filled: state.progress.done, total: state.progress.total, status: 'paused', savedAnswers: answers };
    void saveSession(s).then(() => { setSavedNow(true); setSavedSession(s); });
  }

  function submitTyped() {
    const v = typed.trim();
    if (!v) return;
    setTyped('');
    void engineFor(tabId)?.submitAnswer(v);
  }

  function micTap() {
    micBlocked.current = false; retries.current = 0;
    if (!caps.recognition) { setNotice({ kind: 'info', text: L('ui.noSpeech') }); textRef.current?.focus(); return; }
    voice.listen(settings.answerLang);
  }

  const e = engineFor(tabId);
  const host = schema?.host || (tabUrl ? new URL(tabUrl).hostname : '');
  const phase = state?.phase ?? 'idle';
  const active = !!state && phase !== 'idle';
  const fieldCount = schema?.fields.filter((f) => !f.disabled && !f.readOnly).length ?? 0;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-3 p-3" data-testid="sidepanel">
      {/* header */}
      <header className="flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-1">
          {settings.ai.provider === 'gemini' && settings.ai.consent && <Pill tone="brand"><Sparkles className="h-3 w-3" aria-hidden />AI on</Pill>}
          <Button variant="ghost" aria-label={L('ui.settings')} onClick={() => void chrome.runtime.openOptionsPage()}><Cog className="h-4 w-4" aria-hidden /></Button>
        </div>
      </header>

      <Card className="!p-3">
        <div className="flex items-center justify-between gap-2 text-sm">
          <div className="min-w-0">
            <p className="truncate font-semibold" title={host}>{host || '—'}</p>
            <p className="truncate text-xs text-slate-500 fm-muted" data-testid="form-title">{schema ? `${schema.title} · ${fieldCount} fields${schema.step.isMultiStep ? ` · step ${schema.step.current ?? '?'}${schema.step.total ? `/${schema.step.total}` : ''}` : ''}` : '—'}</p>
          </div>
          <Button variant="ghost" onClick={() => tabId !== null && void scan(tabId, true)} disabled={scanning} aria-label="Scan this page again">{scanning ? '…' : '↻'}</Button>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Select<LangCode> label={L('ui.assistantLang')} value={settings.assistantLang} onChange={(v) => void update({ assistantLang: v, uiLang: v })} options={LANGUAGES.map((l) => ({ value: l.code, label: `${l.native} (${l.label})` }))} />
          <Select<LangCode> label={L('ui.answerLang')} value={settings.answerLang} onChange={(v) => void update({ answerLang: v })} options={LANGUAGES.map((l) => ({ value: l.code, label: `${l.native}` }))} />
        </div>
      </Card>

      {notice && (
        <div role="alert" className={`flex items-start justify-between gap-2 rounded-xl border px-3 py-2 text-sm ${notice.kind === 'error' ? 'border-bad bg-red-50' : notice.kind === 'warn' ? 'border-warn bg-amber-50' : 'border-slate-300 bg-white'}`}>
          <span>{notice.text}</span>
          <span className="flex shrink-0 gap-1">
            {notice.action && <Button variant="primary" onClick={notice.action.run}>{notice.action.label}</Button>}
            <Button variant="ghost" aria-label="Dismiss" onClick={() => setNotice(null)}>✕</Button>
          </span>
        </div>
      )}
      {state?.aiNote && <p className="text-xs text-amber-800">AI was unavailable for that answer ({state.aiNote}). I used the built-in understanding instead.</p>}

      {/* STATE 1 / 2: idle */}
      {!active && view === 'main' && (
        <Card className="space-y-3 text-center">
          {schema ? (
            <>
              <h1 className="text-xl font-bold" data-testid="idle-title">{L('ui.formDetected')}</h1>
              <p className="text-sm text-slate-600 fm-muted">{L('ui.fieldsFound', { n: fieldCount })}</p>
              {savedSession?.savedAnswers && (
                <Button className="w-full" onClick={() => void resumeSaved()}><Check className="h-4 w-4" aria-hidden />Resume saved application</Button>
              )}
              <Button variant="primary" className="w-full !py-3 text-base" onClick={start}><Mic className="h-5 w-5" aria-hidden />{L('ui.start')}</Button>
              <Button variant="ghost" className="w-full" onClick={() => setView('fields')}><List className="h-4 w-4" aria-hidden />{L('ui.reviewFields')}</Button>
              {!caps.recognition && <p className="text-xs text-amber-800">{L('ui.noSpeech')}</p>}
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold">{L('ui.idleTitle')}</h1>
              <p className="text-sm text-slate-600 fm-muted">{L('ui.idleSub')}</p>
              <p className="text-sm font-medium" data-testid="no-form">{L('ui.noForm')}</p>
            </>
          )}
        </Card>
      )}

      {/* field list preview */}
      {view === 'fields' && schema && !active && (
        <Card className="space-y-2">
          <div className="flex items-center justify-between"><h2 className="font-bold">{L('ui.reviewFields')}</h2><Button variant="ghost" onClick={() => setView('main')}>✕</Button></div>
          <ul className="space-y-1 text-sm" data-testid="field-list">
            {schema.fields.filter((f) => !f.disabled && !f.readOnly).map((f) => (
              <li key={f.fieldId} className="flex justify-between gap-2 border-b border-slate-100 py-1">
                <span className="truncate">{f.label}{f.required ? ' *' : ''}</span>
                <span className="shrink-0 text-xs text-slate-500 fm-muted">{f.manualOnly ? 'manual' : f.inputType}</span>
              </li>
            ))}
          </ul>
          <Button variant="primary" className="w-full" onClick={start}>{L('ui.start')}</Button>
        </Card>
      )}

      {/* STATES 3–8: conversation */}
      {active && state && phase !== 'review' && (
        <>
          <Card className="space-y-3">
            <FormProgress progress={state.progress} fields={state.fields} currentId={state.current?.fieldId} label={L('ui.progress', { done: state.progress.done, total: state.progress.total })} />
            {phase === 'paused' ? (
              <div className="space-y-3 text-center">
                <p className="text-lg font-semibold" aria-live="polite">{state.message}</p>
                <Button variant="primary" className="w-full" onClick={() => e?.resume()}><Play className="h-4 w-4" aria-hidden />{L('ui.resume')}</Button>
              </div>
            ) : (
              <>
                <CurrentQuestion state={state} L={L} onAnswer={(tx) => void e?.submitAnswer(tx)} onRepeat={() => e?.repeat()} onSkip={() => e?.skip()} onBack={() => e?.back()} />
                {phase === 'confirming' && state.pending && (
                  <div className="space-y-2 rounded-xl bg-brand-50 p-3" data-testid="confirm-bar">
                    <p className="text-sm font-semibold">“{state.pending.display}”</p>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="success" onClick={() => void e?.confirm(true)}><Check className="h-4 w-4" aria-hidden />{L('ui.confirm')}</Button>
                      <Button onClick={() => { void e?.confirm(false); setTyped(String(state.pending?.display ?? '')); textRef.current?.focus(); }}><Pencil className="h-4 w-4" aria-hidden />{L('ui.edit')}</Button>
                      <Button onClick={() => { void e?.confirm(false); micTap(); }}><Mic className="h-4 w-4" aria-hidden />{L('ui.speakAgain')}</Button>
                    </div>
                  </div>
                )}
                {phase === 'profile_offer' && state.profileOffer && (
                  <div className="flex gap-2" data-testid="profile-offer">
                    <Button variant="success" className="flex-1" onClick={() => void e?.submitAnswer('yes')}>{L('ui.yes')}</Button>
                    <Button className="flex-1" onClick={() => void e?.submitAnswer('no')}>No</Button>
                  </div>
                )}
                <VoiceAssistant
                  status={voiceStatus} busy={state.busy} interim={interim} canListen={caps.recognition && !state.isNotice}
                  onMic={micTap} onStop={() => voice.stopListening()}
                  labels={{ listening: L('ui.listening'), speaking: L('ui.speaking'), processing: L('ui.processing'), tap: L('ui.mic'), stop: L('ui.stop') }}
                />
                <form className="flex gap-2" onSubmit={(ev) => { ev.preventDefault(); submitTyped(); }}>
                  <input ref={textRef} value={typed} onChange={(ev) => setTyped(ev.target.value)} aria-label={L('ui.type')} placeholder={L('ui.type')} className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                  <Button variant="primary" type="submit" aria-label={L('ui.send')}><Send className="h-4 w-4" aria-hidden /></Button>
                </form>
              </>
            )}
          </Card>
          <Transcript lines={state.transcript} youLabel="You" />
          <div className="flex flex-wrap gap-2">
            {phase !== 'paused' && <Button onClick={() => { voice.cancelAll(); e?.pause(); }}><Pause className="h-4 w-4" aria-hidden />{L('ui.pause')}</Button>}
            <Button onClick={() => e?.goReview()}><List className="h-4 w-4" aria-hidden />{L('ui.review')}</Button>
            <Button variant="danger" onClick={() => { voice.cancelAll(); e?.stop(); }}><Square className="h-4 w-4" aria-hidden />{L('ui.stop')}</Button>
            <Button variant="ghost" onClick={() => setShowHelp((v) => !v)}><HelpCircle className="h-4 w-4" aria-hidden />{L('ui.help')}</Button>
          </div>
          {showHelp && (
            <Card className="text-sm">
              <p className="font-semibold mb-1">You can say:</p>
              <ul className="list-disc pl-5 space-y-0.5">
                <li>“Repeat” — hear the question again</li><li>“Skip” — leave it for later</li><li>“Go back”</li>
                <li>“Change my email” — fix an earlier answer</li><li>“What does this mean?”</li><li>“Slower” · “Pause” · “Review”</li>
              </ul>
            </Card>
          )}
        </>
      )}

      {/* review */}
      {active && state && phase === 'review' && state.review && schema && (
        <>
          <FormSummary review={state.review} hasCaptcha={schema.hasCaptcha} saved={savedNow} onSave={saveForLater} onRescan={() => tabId !== null && void scan(tabId, true)} L={L} />
          <Card className="space-y-2"><FormProgress progress={state.progress} fields={state.fields} label={L('ui.progress', { done: state.progress.done, total: state.progress.total })} /><p className="text-sm" aria-live="polite">{state.message}</p></Card>
          <FieldReview review={state.review} onEdit={(id) => e?.jumpTo(id)} onGoTo={(id) => tabId !== null && void sendToTab(tabId, { type: 'FM_HIGHLIGHT', fieldId: id, scroll: true })} />
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => e?.repeat()}>{L('ui.repeat')}</Button>
            <Button className="flex-1" variant="danger" onClick={() => { voice.cancelAll(); e?.stop(); }}>{L('ui.stop')}</Button>
          </div>
        </>
      )}
    </main>
  );
}
