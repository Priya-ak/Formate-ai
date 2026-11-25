import type { FieldOption, FormField, SemanticType } from '@/types/form';
import type { ExtractionResult } from '@/types/ai';
import {
  DIGIT_WORDS, FILLER_PREFIXES, FILLER_SUFFIXES, INTENT_PHRASES, MONTHS, NO_WORDS, REPEAT_WORDS,
  SYNONYM_GROUPS, YES_WORDS, toAsciiDigits, type IntentType,
} from './languageData';
import { isLatin, normalize, sentenceCase, stripFillers, titleCase, tokenize } from '@/utils/text';

// ---------- intents (voice commands) ----------

export interface Intent { type: IntentType; target?: string }

function containsPhrase(text: string, phrase: string): boolean {
  const t = ` ${tokenize(text).join(' ')} `;
  const p = ` ${tokenize(phrase).join(' ')} `;
  if (t.includes(p)) return true;
  // Indic suffixes: allow prefix match for single-word non-Latin phrases
  const pt = tokenize(phrase);
  return !isLatin(phrase) && pt.length === 1 && tokenize(text).some((w) => w.startsWith(pt[0]));
}

/** Detects short control phrases ("repeat", "skip", "change my email"). Long answers are never treated as commands. */
export function detectIntent(text: string, opts: { openText?: boolean } = {}): Intent | null {
  const toks = tokenize(text);
  if (!toks.length) return null;
  const maxTokens = opts.openText ? 4 : 7;
  if (toks.length > maxTokens) return null;
  const order: IntentType[] = ['change', 'repeat', 'skip', 'back', 'slower', 'explain', 'review', 'pause', 'stop', 'help'];
  for (const type of order) {
    for (const p of INTENT_PHRASES[type]) {
      if (containsPhrase(text, p)) {
        if (type === 'change') {
          const pw = tokenize(p);
          const rest = toks.filter((w) => !pw.some((x) => w.startsWith(x)) && !['my', 'the', 'please', 'to', 'it', 'that', 'answer', 'of'].includes(w));
          return { type, target: rest.join(' ') || undefined };
        }
        return { type };
      }
    }
  }
  return null;
}

export function isYes(text: string): boolean {
  const t = tokenize(text);
  return t.some((w) => YES_WORDS.has(w)) && !t.some((w) => NO_WORDS.has(w));
}
export function isNo(text: string): boolean {
  return tokenize(text).some((w) => NO_WORDS.has(w));
}

// ---------- numbers ----------

const EN_UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const EN_TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const EN_ORD: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12,
  thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19, twentieth: 20,
  thirtieth: 30,
};

function evalRun(words: string[]): number | string {
  const w = words.map((x) => x.toLowerCase().replace(/[,.]$/, '')).filter((x) => x && x !== 'and');
  const hasScale = w.includes('hundred') || w.includes('thousand');
  if (!hasScale) {
    // groups of up to two-digit values: "nineteen ninety eight" => 19 | 98
    const groups: number[] = [];
    let cur = 0, open = false;
    for (const x of w) {
      const v = EN_UNITS[x] ?? EN_ORD[x];
      if (x in EN_TENS) { if (open) groups.push(cur); cur = EN_TENS[x]; open = true; }
      else if (v !== undefined) {
        if (open && cur % 10 === 0 && cur >= 20 && v < 10) { cur += v; groups.push(cur); cur = 0; open = false; }
        else { if (open) groups.push(cur); cur = v; open = true; }
      }
    }
    if (open) groups.push(cur);
    if (groups.length === 2 && groups[0] >= 10 && groups[0] <= 99) return `${groups[0]}${String(groups[1]).padStart(2, '0')}`;
    return groups.reduce((a, b) => a + b, 0);
  }
  let total = 0, current = 0;
  for (const x of w) {
    const v = EN_UNITS[x] ?? EN_ORD[x] ?? EN_TENS[x];
    if (v !== undefined) current += v;
    else if (x === 'hundred') current = (current || 1) * 100;
    else if (x === 'thousand') { total += (current || 1) * 1000; current = 0; }
  }
  return total + current;
}

/** "two thousand one" -> "2001", "nineteen ninety eight" -> "1998", "fifth" -> "5". Other text is left alone. */
export function englishNumberWordsToDigits(text: string): string {
  const pieces = text.split(/(\s+)/);
  const out: string[] = [];
  let run: string[] = [];
  const isNumTok = (w: string) => {
    const k = w.toLowerCase().replace(/[,.]$/, '');
    return k in EN_UNITS || k in EN_TENS || k in EN_ORD || k === 'hundred' || k === 'thousand' || k === 'and';
  };
  const flush = () => {
    while (run.length && run[run.length - 1].toLowerCase() === 'and') run.pop();
    if (run.length) out.push(String(evalRun(run)));
    run = [];
  };
  for (const piece of pieces) {
    if (/^\s+$/.test(piece)) { if (!run.length) out.push(piece); continue; }
    if (isNumTok(piece)) run.push(piece);
    else { flush(); if (out.length && !/\s$/.test(out[out.length - 1]) ) out.push(' '); out.push(piece); }
  }
  flush();
  return out.join('').replace(/\s+/g, ' ').trim();
}

/** Spoken digits -> ASCII digits ("nine eight double seven" -> "98877"). */
export function spokenToDigits(text: string): string {
  const toks = tokenize(toAsciiDigits(text));
  let out = '';
  for (let i = 0; i < toks.length; i++) {
    const w = toks[i];
    if (/^\d+$/.test(w)) { out += w; continue; }
    const rep = REPEAT_WORDS[w];
    if (rep && toks[i + 1]) {
      const d = DIGIT_WORDS[toks[i + 1]] ?? (/^\d$/.test(toks[i + 1]) ? toks[i + 1] : '');
      if (d) { out += d.repeat(+rep); i++; continue; }
    }
    const d = DIGIT_WORDS[w];
    if (d !== undefined) out += d;
  }
  return out;
}

export function extractNumber(text: string): number | null {
  const t = englishNumberWordsToDigits(toAsciiDigits(text));
  const m = /-?\d+(?:\.\d+)?/.exec(t);
  if (m) return parseFloat(m[0]);
  const d = spokenToDigits(text);
  return d ? parseInt(d, 10) : null;
}

// ---------- email / phone / dates ----------

export function extractEmail(text: string): string | null {
  // A typed address inside a sentence ("it is asha@example.com") is used as-is.
  const literal = /[a-z0-9._%+\-]+@[a-z0-9\-]+(?:\.[a-z0-9\-]+)*\.[a-z]{2,}/i.exec(text);
  if (literal) return literal[0].toLowerCase();
  let t = ' ' + text.toLowerCase() + ' ';
  t = t
    .replace(/\s+at\s+the\s+rate(\s+of)?\s+/g, '@')
    .replace(/एट\s*द\s*रेट|அட் தி ரேட்|ఎట్ ది రేట్/g, '@')
    .replace(/\s+at\s+/g, '@')
    .replace(/\s+(dot|period|point)\s+/g, '.')
    .replace(/\s*(डॉट|டாட்|డాట్|ಡಾಟ್|ഡോട്ട്|ডট)\s*/g, '.')
    .replace(/\s+(underscore|under score)\s+/g, '_')
    .replace(/\s+(dash|hyphen|minus)\s+/g, '-')
    .replace(/g\s+mail/g, 'gmail')
    .replace(/\s+plus\s+/g, '+');
  const toks = t.trim().split(/\s+/).map((w) => DIGIT_WORDS[w] ?? w);
  const joined = toAsciiDigits(toks.join('').replace(/[,;]/g, ''));
  const m = /[a-z0-9._%+\-]+@[a-z0-9\-]+(?:\.[a-z0-9\-]+)*\.[a-z]{2,}/.exec(joined);
  return m ? m[0] : null;
}

export function extractPhone(text: string): string | null {
  let d = spokenToDigits(text);
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d.length >= 7 ? d : null;
}

function validDate(y: number, m: number, d: number): boolean {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const fullYear = (y: number) => (y < 100 ? (y > 30 ? 1900 + y : 2000 + y) : y);

export function parseSpokenDate(text: string, now = new Date()): string | null {
  const t = englishNumberWordsToDigits(toAsciiDigits(text.toLowerCase())).replace(/(\d+)(st|nd|rd|th)\b/g, '$1');
  let m = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/.exec(t);
  if (m && validDate(+m[1], +m[2], +m[3])) return iso(+m[1], +m[2], +m[3]);
  m = /\b(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{2,4})\b/.exec(t);
  if (m) {
    let d = +m[1], mo = +m[2];
    if (mo > 12 && d <= 12) [d, mo] = [mo, d];
    const y = fullYear(+m[3]);
    if (validDate(y, mo, d)) return iso(y, mo, d);
  }
  const toks = t.split(/[\s,./\-]+/).filter(Boolean);
  const mi = toks.findIndex((w) => MONTHS[w] !== undefined);
  if (mi >= 0) {
    const nums = toks.map((w, i) => ({ v: /^\d+$/.test(w) ? +w : NaN, i })).filter((x) => !Number.isNaN(x.v));
    const yearTok = nums.find((x) => x.v >= 100);
    const dayTok = nums.find((x) => x.v >= 1 && x.v <= 31 && x !== yearTok);
    const yTok = yearTok ?? nums.find((x) => x !== dayTok);
    if (dayTok && yTok) {
      const y = fullYear(yTok.v);
      if (validDate(y, MONTHS[toks[mi]], dayTok.v)) return iso(y, MONTHS[toks[mi]], dayTok.v);
    }
  }
  if (/\btoday\b/.test(t)) return iso(now.getFullYear(), now.getMonth() + 1, now.getDate());
  if (/\btomorrow\b/.test(t)) { const d = new Date(now.getTime() + 86400000); return iso(d.getFullYear(), d.getMonth() + 1, d.getDate()); }
  return null;
}

// ---------- option matching ----------

function groupsOf(text: string): Set<string> {
  const toks = new Set(tokenize(text));
  const norm = normalize(text);
  const hit = new Set<string>();
  for (const [g, words] of Object.entries(SYNONYM_GROUPS)) {
    for (const w of words) {
      const wn = normalize(w);
      const ok = isLatin(w) ? (toks.has(wn) || (wn.includes(' ') && norm.includes(wn))) : norm.includes(wn);
      if (ok) { hit.add(g); break; }
    }
  }
  return hit;
}

export interface OptionMatch { option: FieldOption; score: number }

export function matchOptions(text: string, options: FieldOption[]): OptionMatch[] {
  const usable = options.filter((o) => !o.disabled);
  const nt = normalize(text);
  const ut = new Set(tokenize(text));
  const ug = groupsOf(text);
  const scored = usable.map((o) => {
    const nl = normalize(o.label), nv = normalize(o.value);
    let score = 0;
    if (nl && (nt === nl || nt === nv)) score = 1;
    else {
      const lt = tokenize(o.label);
      const contained = lt.length ? lt.filter((w) => ut.has(w)).length / lt.length : 0;
      const phraseHit = nl ? (isLatin(nl) ? ` ${nt} `.includes(` ${nl} `) : nt.includes(nl)) : false;
      if (phraseHit) score = Math.max(score, 0.9);
      if (contained >= 0.99) score = Math.max(score, 0.85);
      else if (contained >= 0.5) score = Math.max(score, 0.6 + contained * 0.2);
      const og = groupsOf(o.label + ' ' + o.value);
      if ([...og].some((g) => ug.has(g))) score = Math.max(score, 0.9);
      if (!score && nl.length > 3 && nt.length >= 3 && nl.startsWith(nt)) score = 0.65;
    }
    return { option: o, score };
  });
  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
}

export function bestOption(text: string, options: FieldOption[]): { match?: OptionMatch; ambiguous?: OptionMatch[] } {
  const ranked = matchOptions(text, options);
  if (!ranked.length || ranked[0].score < 0.6) return {};
  const top = ranked.filter((r) => ranked[0].score - r.score < 0.05 && r.score >= 0.6);
  if (top.length > 1 && ranked[0].score < 1) return { ambiguous: top };
  return { match: ranked[0] };
}

// ---------- main extractor ----------

const OPEN_TEXT: SemanticType[] = ['experience', 'why_apply', 'summary', 'skills', 'education'];
const CONFIRM_TYPES: SemanticType[] = ['phone', 'email', 'dob', 'id_number', 'generic_date', 'start_date', 'postal_code'];

function stripLeadIns(text: string, label: string): string {
  let t = text.trim();
  for (const re of FILLER_PREFIXES) t = t.replace(re, '');
  for (const re of FILLER_SUFFIXES) t = t.replace(re, '');
  const words = tokenize(label).filter((w) => w.length > 2).slice(0, 4);
  if (words.length) {
    const esc = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    t = t.replace(new RegExp(`^(my\\s+|the\\s+)?(${esc})(\\s+\\w+)?\\s+(is|are|was)\\s+`, 'i'), '');
  }
  return t.replace(/^[,.\s]+|[.\s]+$/g, '').trim();
}

function result(field: FormField, value: ExtractionResult['extractedValue'], confidence: number, extra: Partial<ExtractionResult> = {}): ExtractionResult {
  return {
    fieldId: field.fieldId, extractedValue: value, confidence, source: 'rules',
    needsConfirmation: extra.needsConfirmation ?? (confidence < 0.7 || CONFIRM_TYPES.includes(field.semanticType) || field.legal),
    ...extra,
  };
}

const fail = (field: FormField, clarification: string): ExtractionResult =>
  ({ fieldId: field.fieldId, extractedValue: null, confidence: 0, needsConfirmation: false, source: 'rules', clarification });

/** Rule-based answer extraction. Never invents data: returns null + clarification when unsure. */
export function extractAnswer(field: FormField, rawText: string): ExtractionResult {
  const text = stripFillers(rawText.trim());
  if (!text) return fail(field, 'empty');
  const t = field.semanticType;

  switch (field.inputType) {
    case 'select': case 'radio': {
      const { match, ambiguous } = bestOption(text, field.options);
      if (match) return result(field, match.option.value, match.score, { matchedOption: match.option.label, needsConfirmation: match.score < 0.8 });
      return fail(field, ambiguous ? 'ambiguous' : 'no_option');
    }
    case 'multiselect': case 'checkbox-group': {
      const parts = text.split(/\s*(?:,|\band\b|\bplus\b|மற்றும்|और|&)\s*/i);
      const found = new Map<string, string>();
      for (const p of parts) {
        const { match } = bestOption(p, field.options);
        if (match) found.set(match.option.value, match.option.label);
      }
      if (!found.size) return fail(field, 'no_option');
      return result(field, [...found.keys()], 0.85, { matchedOption: [...found.values()].join(', '), needsConfirmation: true });
    }
    case 'checkbox': {
      if (isNo(text)) return result(field, false, 0.9, { needsConfirmation: field.legal });
      if (isYes(text) || /agree|accept|tick|select|check/i.test(text)) return result(field, true, 0.9, { needsConfirmation: field.legal });
      return fail(field, 'yesno');
    }
    case 'file': return fail(field, 'file');
    default: break;
  }

  switch (t) {
    case 'email': {
      const e = extractEmail(text);
      return e ? result(field, e, 0.92, { needsConfirmation: true }) : fail(field, 'invalid_email');
    }
    case 'phone': {
      const p = extractPhone(text);
      return p ? result(field, p, 0.9, { needsConfirmation: true }) : fail(field, 'invalid_phone');
    }
    case 'postal_code': {
      const d = spokenToDigits(text);
      return d.length >= 4 ? result(field, d, 0.9, { needsConfirmation: true }) : fail(field, 'invalid_postal');
    }
    case 'dob': case 'generic_date': case 'start_date': {
      const d = parseSpokenDate(text);
      if (d) return result(field, d, 0.88, { needsConfirmation: true });
      if (t === 'start_date' && field.inputType !== 'date') return result(field, stripLeadIns(text, field.label), 0.7);
      return fail(field, 'invalid_date');
    }
    case 'years_experience': case 'generic_number': case 'graduation_year': case 'salary_expectation': {
      const n = extractNumber(text);
      if (n === null) return fail(field, 'invalid_number');
      return result(field, String(n), 0.85, { needsConfirmation: t === 'salary_expectation' });
    }
    case 'full_name': case 'first_name': case 'last_name': {
      let n = stripLeadIns(text, field.label);
      if (!n || /\d/.test(n) || tokenize(n).length > 6) return fail(field, 'invalid_name');
      if (isLatin(n) && n === n.toLowerCase()) n = titleCase(n);
      const parts = n.split(/\s+/);
      if (t === 'first_name') n = parts[0];
      if (t === 'last_name') n = parts.length > 1 ? parts[parts.length - 1] : parts[0];
      const latin = isLatin(n);
      return result(field, n, latin ? 0.9 : 0.75, { needsConfirmation: !latin, note: latin ? undefined : 'non_latin' });
    }
    default: break;
  }

  if (field.inputType === 'date') {
    const d = parseSpokenDate(text);
    return d ? result(field, d, 0.85, { needsConfirmation: true }) : fail(field, 'invalid_date');
  }
  if (field.inputType === 'number') {
    const n = extractNumber(text);
    return n === null ? fail(field, 'invalid_number') : result(field, String(n), 0.85);
  }
  if (field.inputType === 'email') { const e = extractEmail(text); return e ? result(field, e, 0.9, { needsConfirmation: true }) : fail(field, 'invalid_email'); }
  if (field.inputType === 'tel') { const p = extractPhone(text); return p ? result(field, p, 0.9, { needsConfirmation: true }) : fail(field, 'invalid_phone'); }

  // free text: keep the user's own words
  let v = stripLeadIns(text, field.label);
  if (!v) v = text;
  if (field.inputType === 'textarea' || OPEN_TEXT.includes(t)) v = isLatin(v) ? sentenceCase(v) : v;
  const latin = isLatin(v);
  const maxLen = field.maxLength;
  const tooLong = !!maxLen && v.length > maxLen;
  return result(field, tooLong ? v.slice(0, maxLen) : v, latin ? 0.85 : 0.7, {
    needsConfirmation: (!latin && field.inputType !== 'textarea') || tooLong,
    note: tooLong ? 'truncated' : latin ? undefined : 'non_latin',
  });
}
