import type { FillResult, FormField, FormSchema } from '@/types/form';
import type { ExtractionResult } from '@/types/ai';
import type { ConversationPhase, Progress, ReviewSummary, UserProfile } from '@/types/session';
import type { LangCode } from '@/types/voice';
import { detectIntent, isNo, isYes, type Intent } from './answerExtractor';
import { displayValue, suggestFromProfile, type ProfileSuggestion } from './fieldMapper';
import { hasKey, tx } from '@/services/i18n';
import { validateValue } from '@/services/form/validator';
import { normalize, tokenize } from '@/utils/text';

export interface EngineHost {
  fill(fieldId: string, value: string | string[] | boolean): Promise<FillResult>;
  highlight(fieldId: string, scroll?: boolean): void;
  clearHighlight(): void;
  extract(field: FormField, text: string): Promise<ExtractionResult & { aiError?: string }>;
  explain?(field: FormField): Promise<string | null>;
}

export interface EngineOptions {
  assistantLang: LangCode;
  confirmEveryAnswer: boolean;
  profile: UserProfile | null;
  profileEnabled: boolean;
  aiAvailable: boolean;
}

export interface ChatLine { role: 'assistant' | 'user' | 'system'; text: string; at: number }

export interface EngineState {
  phase: ConversationPhase;
  current: FormField | null;
  /** Value waiting for the user's confirmation. */
  pending: { value: string | string[] | boolean; display: string; note?: string } | null;
  message: string;
  messageLang: LangCode;
  /** Increments for every new assistant utterance so the UI can speak it exactly once. */
  messageSeq: number;
  transcript: ChatLine[];
  progress: Progress;
  fields: FormField[];
  review: ReviewSummary | null;
  isNotice: boolean;
  busy: boolean;
  failures: number;
  wantsSlower: boolean;
  aiNote?: string;
  profileOffer: ProfileSuggestion | null;
  canGoBack: boolean;
}

const ASKABLE_STATUS = new Set(['pending', 'asked', 'answered', 'error']);

const ALIASES: Record<string, string[]> = {
  full_name: ['name', 'full name', 'பெயர்', 'नाम'],
  first_name: ['first name'], last_name: ['last name', 'surname'],
  email: ['email', 'mail', 'மின்னஞ்சல்', 'ईमेल'],
  phone: ['phone', 'mobile', 'number', 'contact', 'தொலைபேசி', 'फोन', 'फ़ोन', 'मोबाइल'],
  address: ['address', 'முகவரி', 'पता'],
  dob: ['birth', 'dob', 'birthday', 'பிறந்த', 'जन्म'],
  education: ['education', 'qualification', 'degree', 'கல்வி', 'शिक्षा'],
  skills: ['skills', 'skill', 'திறன்', 'कौशल'],
  experience: ['experience', 'அனுபவம்', 'अनुभव'],
  why_apply: ['why', 'reason'],
  availability: ['availability', 'available'],
};

export class ConversationEngine {
  private schema: FormSchema | null = null;
  private order: string[] = [];
  private cursor = -1;
  private fields = new Map<string, FormField>();
  private uncertain = new Set<string>();
  private seq = 0;
  private listeners = new Set<(s: EngineState) => void>();
  private prevPhase: ConversationPhase = 'asking';
  private offer: ProfileSuggestion | null = null;
  private declinedProfile = new Set<string>();
  private st: EngineState;

  constructor(private host: EngineHost, private opts: EngineOptions) {
    this.st = {
      phase: 'idle', current: null, pending: null, message: '', messageLang: opts.assistantLang, messageSeq: 0,
      transcript: [], progress: { done: 0, total: 0, percent: 0 }, fields: [], review: null, isNotice: false, busy: false,
      failures: 0, wantsSlower: false, profileOffer: null, canGoBack: false,
    };
  }

  // ---------- public API ----------
  subscribe(fn: (s: EngineState) => void): () => void { this.listeners.add(fn); fn(this.snapshot()); return () => this.listeners.delete(fn); }
  getState(): EngineState { return this.snapshot(); }
  setOptions(o: Partial<EngineOptions>) { this.opts = { ...this.opts, ...o }; }

  load(schema: FormSchema) {
    this.schema = schema;
    this.fields = new Map(schema.fields.map((f) => [f.fieldId, { ...f }]));
    this.order = schema.fields.map((f) => f.fieldId);
    this.cursor = -1;
    this.st.phase = 'idle';
    this.st.current = null;
    this.emit();
  }

  start() {
    if (!this.schema) return;
    const n = this.askableIds().length;
    const intro = tx(this.opts.assistantLang, 'greet', { n: this.order.length, title: this.schema.title });
    this.cursor = -1;
    this.advance(intro.text, intro.lang);
    void n;
  }

  async submitAnswer(text: string): Promise<void> {
    const raw = text.trim();
    if (!raw || this.st.busy) return;
    this.addLine('user', raw);
    const phase = this.st.phase;

    if (phase === 'paused') { this.resume(); return; }

    // 1. yes/no answers to confirmation questions
    if (phase === 'confirming' && this.st.pending) {
      if (isYes(raw) && !isNo(raw)) return this.confirm(true);
      if (isNo(raw)) return this.confirm(false);
    }
    if (phase === 'profile_offer' && this.offer) {
      if (isYes(raw) && !isNo(raw)) return this.acceptProfile();
      if (isNo(raw)) return this.declineProfile();
    }

    // 2. voice commands
    const cur = this.st.current;
    const intent = detectIntent(raw, { openText: !!cur && (cur.inputType === 'textarea' || ['experience', 'why_apply', 'summary'].includes(cur.semanticType)) });
    if (intent && !(phase === 'confirming' && intent.type === 'skip' && false)) {
      const handled = await this.handleIntent(intent);
      if (handled) return;
    }

    // 3. a normal answer for the current field
    if (!cur) { this.say(tx(this.opts.assistantLang, 'help')); return; }
    if (this.st.isNotice) { this.skip(); return; }
    await this.answerField(cur, raw);
  }

  /** Called by the UI's Confirm / Change buttons or by yes/no speech. */
  async confirm(accept: boolean): Promise<void> {
    const cur = this.st.current;
    const p = this.st.pending;
    if (!cur || !p) return;
    if (accept) { await this.commit(cur, p.value, true); return; }
    this.st.pending = null;
    this.st.phase = 'asking';
    this.say(tx(this.opts.assistantLang, 'retry'), false);
    this.emit();
  }

  repeat() {
    const cur = this.st.current;
    if (!cur) return;
    if (this.st.phase === 'review') { this.goReview(); return; }
    if (this.st.phase === 'confirming' && this.st.pending) {
      this.say(tx(this.opts.assistantLang, 'heard', { value: this.st.pending.display }));
      return;
    }
    this.say(this.question(cur));
  }

  skip() {
    const cur = this.st.current;
    if (!cur) return;
    const f = this.fields.get(cur.fieldId)!;
    if (!this.st.isNotice) {
      if (f.status !== 'filled' && f.status !== 'confirmed') f.status = f.required ? 'pending' : 'skipped';
      this.syncField(f);
    }
    this.advance(this.st.isNotice ? undefined : tx(this.opts.assistantLang, 'skipped', { label: f.label }).text);
  }

  back() {
    for (let i = this.cursor - 1; i >= 0; i--) {
      const f = this.fields.get(this.order[i]);
      if (f && this.isAskable(f, true)) { this.cursor = i; this.ask(f); return; }
    }
    this.repeat();
  }

  jumpTo(fieldId: string) {
    const i = this.order.indexOf(fieldId);
    const f = this.fields.get(fieldId);
    if (i < 0 || !f) return;
    this.cursor = i;
    this.st.pending = null;
    this.say(tx(this.opts.assistantLang, 'change', { label: f.label }), false);
    this.ask(f, true);
  }

  pause() {
    if (this.st.phase === 'paused') return;
    this.prevPhase = this.st.phase;
    this.st.phase = 'paused';
    this.host.clearHighlight();
    this.say(tx(this.opts.assistantLang, 'paused'));
  }

  resume() {
    if (this.st.phase !== 'paused') return;
    this.st.phase = this.prevPhase === 'paused' ? 'asking' : this.prevPhase;
    const cur = this.st.current;
    const r = tx(this.opts.assistantLang, 'resumed');
    if (cur) { const q = this.question(cur); this.say({ text: `${r.text} ${q.text}`, lang: q.lang, fallback: q.fallback }); if (this.st.phase === 'confirming') this.st.phase = 'asking'; }
    else this.goReview();
  }

  stop() {
    this.host.clearHighlight();
    this.cursor = -1;
    this.st.phase = 'idle';
    this.st.current = null;
    this.st.pending = null;
    this.st.review = null;
    this.emit();
  }

  goReview() {
    this.host.clearHighlight();
    const review = this.buildReview();
    this.st.review = review;
    this.st.phase = 'review';
    this.st.pending = null;
    this.st.isNotice = false;
    const attention = review.missing.length + review.invalid.length + review.manual.filter((f) => f.required || f.inputType === 'file').length;
    const parts: string[] = [];
    let lang: LangCode = this.opts.assistantLang;
    const intro = tx(lang, attention ? 'review.intro' : 'review.ready', { filled: review.completed.length, attention });
    lang = intro.lang;
    parts.push(intro.text);
    review.missing.slice(0, 3).forEach((f) => parts.push(tx(lang, 'review.missing', { label: f.label }).text));
    if (this.schema?.hasCaptcha) parts.push(tx(lang, 'captcha').text);
    parts.push(tx(lang, 'submit').text);
    this.say({ text: parts.join(' '), lang, fallback: intro.fallback });
    const first = review.missing[0] || review.invalid[0] || review.manual[0];
    if (first) this.host.highlight(first.fieldId, true);
  }

  getReview(): ReviewSummary { return this.buildReview(); }

  /** A newly scanned schema (dynamic fields, next step of a multi-step form). Keeps earlier answers. */
  updateSchema(schema: FormSchema, reason: 'mutation' | 'navigation' | 'step' | 'initial' = 'mutation') {
    if (!this.schema) { this.load(schema); return; }
    const byKey = new Map<string, FormField>();
    this.fields.forEach((f) => byKey.set(f.key, f));
    const prevCurrentKey = this.st.current?.key;
    const before = new Set(this.fields.keys());
    const next = new Map<string, FormField>();
    let added = 0;
    for (const nf of schema.fields) {
      const old = byKey.get(nf.key);
      if (old) {
        const keepStatus = ['filled', 'confirmed', 'skipped', 'needs_attention', 'error'].includes(old.status) && !(nf.prefilled && old.status !== 'filled');
        next.set(nf.fieldId, {
          ...nf,
          status: keepStatus ? (nf.prefilled && old.status === 'error' ? 'filled' : old.status) : nf.status,
          note: old.note,
          validationError: nf.validationError,
        });
        if (nf.prefilled && nf.status === 'filled' && old.status === 'pending') next.get(nf.fieldId)!.status = 'filled';
      } else { next.set(nf.fieldId, nf); if (!before.has(nf.fieldId)) added++; }
    }
    this.schema = schema;
    this.fields = next;
    this.order = schema.fields.map((f) => f.fieldId);
    const cur = prevCurrentKey ? [...next.values()].find((f) => f.key === prevCurrentKey) : undefined;
    this.cursor = cur ? this.order.indexOf(cur.fieldId) : this.cursor;
    if (this.st.phase === 'idle' || this.st.phase === 'paused') { this.emit(); return; }
    if (cur) this.st.current = next.get(cur.fieldId)!;
    const remaining = this.askableIds().length;
    if ((this.st.phase === 'review' || this.st.phase === 'done') && remaining > 0 && (added > 0 || reason === 'step')) {
      this.cursor = -1;
      this.advance(tx(this.opts.assistantLang, 'step.new', { n: remaining }).text);
      return;
    }
    if (!cur && this.st.phase !== 'review') { this.advance(); return; }
    this.emit();
  }

  /** The user typed into a field on the page themselves. */
  noteManualEdit(fieldId: string, value: string | string[] | boolean) {
    const f = this.fields.get(fieldId);
    if (!f) return;
    const empty = value === '' || value === false || (Array.isArray(value) && !value.length);
    f.value = value;
    f.status = empty ? (f.required ? 'pending' : 'skipped') : 'filled';
    f.prefilled = false;
    this.syncField(f);
    if (this.st.current?.fieldId === fieldId && !empty && ['asking', 'confirming', 'profile_offer'].includes(this.st.phase)) {
      this.st.pending = null;
      this.advance();
    } else this.emit();
  }

  // ---------- internals ----------
  private askableIds(): string[] {
    return this.order.filter((id) => { const f = this.fields.get(id); return !!f && this.isAskable(f, false); });
  }

  private isAskable(f: FormField, includeDone: boolean): boolean {
    if (f.disabled || f.readOnly) return false;
    if (f.manualOnly || f.inputType === 'file') return !includeDone ? ['pending', 'needs_attention'].includes(f.status) && !this.noticed.has(f.fieldId) : true;
    return includeDone ? true : ASKABLE_STATUS.has(f.status);
  }
  private noticed = new Set<string>();

  private advance(prefix?: string, prefixLang?: LangCode) {
    for (let i = this.cursor + 1; i < this.order.length; i++) {
      const f = this.fields.get(this.order[i]);
      if (f && this.isAskable(f, false)) { this.cursor = i; this.ask(f, false, prefix, prefixLang); return; }
    }
    // nothing left to ask
    if (prefix) this.st.message = prefix;
    this.goReview();
  }

  private question(f: FormField): { text: string; lang: LangCode; fallback: boolean } {
    const lang = this.opts.assistantLang;
    if (f.manualOnly) return tx(lang, f.semanticType === 'captcha' ? 'captcha' : 'manual', { label: f.label });
    if (f.inputType === 'file') return tx(lang, 'upload', { label: f.label });
    if (f.inputType === 'checkbox') return tx(lang, f.legal || f.semanticType === 'consent' ? 'ask.consent' : 'ask.yesno', { label: f.label });
    if (['select', 'radio', 'multiselect', 'checkbox-group'].includes(f.inputType)) {
      const options = f.options.filter((o) => !o.disabled).slice(0, 10).map((o) => o.label).join(', ');
      return tx(lang, 'ask.choice', { label: f.label, options });
    }
    const key = `ask.${f.semanticType}`;
    if (hasKey(lang, key)) return tx(lang, key, { label: f.label });
    return tx(lang, 'ask.generic', { label: f.label });
  }

  private ask(f: FormField, forceFresh = false, prefix?: string, prefixLang?: LangCode) {
    const cur = this.fields.get(f.fieldId)!;
    this.st.current = cur;
    this.st.pending = null;
    this.st.failures = 0;
    this.st.isNotice = cur.manualOnly || cur.inputType === 'file';
    this.st.canGoBack = this.order.slice(0, this.cursor).some((id) => { const x = this.fields.get(id); return !!x && this.isAskable(x, true); });
    if (cur.status === 'pending' || forceFresh) cur.status = 'asked';
    this.syncField(cur);
    this.host.highlight(cur.fieldId, true);

    const q = this.question(cur);
    if (this.st.isNotice) { this.noticed.add(cur.fieldId); if (cur.status !== 'filled') { cur.status = 'needs_attention'; this.syncField(cur); } }

    // saved-profile offer (never silent)
    if (!this.st.isNotice && !forceFresh && !this.declinedProfile.has(cur.fieldId)) {
      const sug = suggestFromProfile(cur, this.opts.profile, this.opts.profileEnabled);
      if (sug) {
        this.offer = sug;
        this.st.profileOffer = sug;
        this.st.phase = 'profile_offer';
        const o = tx(this.opts.assistantLang, 'ask.profile', { label: cur.label, value: sug.display });
        this.say(prefix ? { text: `${prefix} ${o.text}`, lang: o.lang, fallback: o.fallback } : o);
        return;
      }
    }
    this.offer = null;
    this.st.profileOffer = null;
    this.st.phase = 'asking';
    const text = prefix ? `${prefix} ${q.text}` : q.text;
    this.say({ text, lang: prefix && prefixLang && prefixLang !== q.lang ? q.lang : q.lang, fallback: q.fallback });
  }

  private async acceptProfile() {
    const cur = this.st.current;
    const o = this.offer;
    if (!cur || !o) return;
    this.offer = null; this.st.profileOffer = null;
    await this.commit(cur, o.value, true);
  }

  private declineProfile() {
    const cur = this.st.current;
    if (!cur) return;
    this.declinedProfile.add(cur.fieldId);
    this.offer = null; this.st.profileOffer = null;
    this.st.phase = 'asking';
    this.say(this.question(cur));
  }

  private async answerField(cur: FormField, raw: string) {
    this.st.busy = true; this.emit();
    let res: ExtractionResult & { aiError?: string };
    try { res = await this.host.extract(cur, raw); }
    catch { res = { fieldId: cur.fieldId, extractedValue: null, confidence: 0, needsConfirmation: false, source: 'rules', clarification: 'error' }; }
    this.st.busy = false;
    this.st.aiNote = res.aiError;

    if (res.extractedValue === null || res.extractedValue === '') return this.handleNoValue(cur, res);

    const value = res.extractedValue;
    const v = validateValue(cur, value);
    if (!v.ok) {
      this.st.failures++;
      this.say(tx(this.opts.assistantLang, 'invalid', { reason: tx(this.opts.assistantLang, v.reasonKey || 'reason.required').text }));
      return;
    }
    if (res.confidence < 0.7 || res.note === 'non_latin') this.uncertain.add(cur.fieldId);

    const legalDirect = cur.inputType === 'checkbox' && cur.legal; // the question itself asked for explicit consent
    const confirm = !legalDirect && (res.needsConfirmation || this.opts.confirmEveryAnswer);
    const display = displayValue(cur, value as FormField['value']);
    if (confirm) {
      this.st.pending = { value, display, note: res.note };
      this.st.phase = 'confirming';
      const msg = res.note === 'non_latin' ? tx(this.opts.assistantLang, 'nonlatin', { value: display }) : tx(this.opts.assistantLang, 'heard', { value: display });
      this.say(msg);
      return;
    }
    await this.commit(cur, value, false);
  }

  private handleNoValue(cur: FormField, res: ExtractionResult) {
    this.st.failures++;
    const lang = this.opts.assistantLang;
    const c = res.clarification || '';
    const options = cur.options.filter((o) => !o.disabled).slice(0, 10).map((o) => o.label).join(', ');
    if (c === 'no_option') return this.say(tx(lang, 'nomatch.option', { options }));
    if (c === 'ambiguous') return this.say(tx(lang, 'ambiguous', { options }));
    const reasonKey = c === 'invalid_email' ? 'reason.email' : c === 'invalid_phone' ? 'reason.phone' : c === 'invalid_date' ? 'reason.date'
      : c === 'invalid_number' ? 'reason.number' : c === 'invalid_postal' ? 'reason.postal' : '';
    if (reasonKey) return this.say(tx(lang, 'invalid', { reason: tx(lang, reasonKey).text }));
    if (res.clarification && !['empty', 'unclear', 'error', 'yesno', 'file', 'invalid_name'].includes(c)) return this.say({ text: res.clarification, lang, fallback: false });
    this.say(tx(lang, 'retry'));
  }

  private async commit(cur: FormField, value: string | string[] | boolean, confirmed: boolean) {
    this.st.busy = true;
    this.st.phase = 'asking';
    this.st.pending = null;
    this.emit();
    const f = this.fields.get(cur.fieldId)!;
    f.status = 'answered';
    const r = await this.host.fill(cur.fieldId, value);
    this.st.busy = false;
    const lang = this.opts.assistantLang;
    if (!r.ok) {
      f.status = 'error';
      f.validationError = r.error;
      this.syncField(f);
      this.st.failures++;
      this.advance(tx(lang, 'fill.failed', { label: f.label, msg: r.error || '' }).text);
      return;
    }
    f.value = r.actual ?? value;
    f.status = confirmed ? 'confirmed' : 'filled';
    f.prefilled = false;
    f.validationError = r.validationError;
    this.syncField(f);
    if (r.validationError) {
      f.status = 'needs_attention';
      this.syncField(f);
      this.say(tx(lang, 'site.rejected', { msg: r.validationError }));
      this.st.phase = 'asking';
      return;
    }
    const disp = displayValue(f, f.value);
    let ack;
    if (f.inputType === 'checkbox') ack = tx(lang, f.value === true ? 'ack.checked' : 'ack.unchecked');
    else if (['select', 'radio', 'multiselect', 'checkbox-group'].includes(f.inputType)) ack = tx(lang, 'ack.choice', { value: disp });
    else ack = tx(lang, 'ack', { value: f.sensitive ? '•••' : disp.length > 60 ? disp.slice(0, 57) + '…' : disp });
    this.advance(ack.text, ack.lang);
  }

  private async handleIntent(intent: Intent): Promise<boolean> {
    const lang = this.opts.assistantLang;
    switch (intent.type) {
      case 'repeat': this.repeat(); return true;
      case 'skip': if (this.st.phase === 'review') return false; this.skip(); return true;
      case 'back': this.back(); return true;
      case 'pause': this.pause(); return true;
      case 'stop': this.stop(); return true;
      case 'review': this.goReview(); return true;
      case 'slower': this.st.wantsSlower = true; this.say(tx(lang, 'slower')); return true;
      case 'help': this.say(tx(lang, 'help')); return true;
      case 'explain': {
        const cur = this.st.current;
        if (!cur) return false;
        const ai = this.host.explain ? await this.host.explain(cur) : null;
        const parts = [tx(lang, 'explain', { label: cur.label }).text];
        if (ai) parts.push(ai);
        else if (cur.helpText || cur.placeholder) parts.push(tx(lang, 'explain.more', { help: cur.helpText || cur.placeholder }).text);
        else if (!this.opts.aiAvailable) parts.push(tx(lang, 'explain.ai').text);
        this.say({ text: parts.join(' '), lang, fallback: false });
        return true;
      }
      case 'change': {
        const target = this.findFieldByWords(intent.target || '');
        if (target) { this.jumpTo(target.fieldId); return true; }
        if (intent.target && this.st.current) return false; // treat as a normal answer containing the word "change"
        this.say(tx(lang, 'change.which'));
        return true;
      }
      default: return false;
    }
  }

  private findFieldByWords(words: string): FormField | null {
    if (!words) return null;
    const toks = tokenize(words);
    let best: { f: FormField; score: number } | null = null;
    for (const f of this.fields.values()) {
      if (f.disabled || f.readOnly || f.manualOnly) continue;
      const hay = `${normalize(f.label)} ${(ALIASES[f.semanticType] || []).join(' ')}`;
      const score = toks.filter((t) => hay.includes(t)).length;
      if (score > 0 && (!best || score > best.score)) best = { f, score };
    }
    return best ? best.f : null;
  }

  private buildReview(): ReviewSummary {
    const all = [...this.fields.values()].sort((a, b) => a.orderIndex - b.orderIndex);
    const isEmpty = (f: FormField) => f.value === '' || f.value === false || (Array.isArray(f.value) && !f.value.length);
    const review: ReviewSummary = { completed: [], missing: [], uncertain: [], invalid: [], manual: [], skipped: [] };
    for (const f of all) {
      if (f.disabled || f.readOnly) continue;
      if (f.manualOnly || f.inputType === 'file') { if (isEmpty(f) && f.status !== 'filled') review.manual.push(f); else review.completed.push(f); continue; }
      if (f.status === 'error' || f.validationError || f.status === 'needs_attention') { review.invalid.push(f); continue; }
      if (f.status === 'filled' || f.status === 'confirmed') {
        review.completed.push(f);
        if (this.uncertain.has(f.fieldId)) review.uncertain.push(f);
        continue;
      }
      if (f.status === 'skipped' && !f.required) { review.skipped.push(f); continue; }
      if (f.required) review.missing.push(f); else review.skipped.push(f);
    }
    return review;
  }

  private progress(): Progress {
    const rel = [...this.fields.values()].filter((f) => !f.disabled && !f.readOnly && !f.manualOnly);
    const done = rel.filter((f) => f.status === 'filled' || f.status === 'confirmed').length;
    return { done, total: rel.length, percent: rel.length ? Math.round((done / rel.length) * 100) : 0 };
  }

  private syncField(f: FormField) { this.fields.set(f.fieldId, f); if (this.st.current?.fieldId === f.fieldId) this.st.current = f; this.emit(); }

  private say(t: { text: string; lang: LangCode; fallback?: boolean }, record = true) {
    this.st.message = t.text;
    this.st.messageLang = t.lang;
    this.st.messageSeq = ++this.seq;
    if (record) this.addLine('assistant', t.text, false);
    this.emit();
  }

  private addLine(role: ChatLine['role'], text: string, emit = true) {
    this.st.transcript = [...this.st.transcript.slice(-29), { role, text, at: Date.now() }];
    if (emit) this.emit();
  }

  private snapshot(): EngineState {
    return {
      ...this.st,
      fields: [...this.fields.values()].sort((a, b) => a.orderIndex - b.orderIndex),
      progress: this.progress(),
    };
  }

  private emit() { const s = this.snapshot(); this.listeners.forEach((l) => l(s)); }
}
