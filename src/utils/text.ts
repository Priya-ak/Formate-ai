/** Small text helpers shared by the classifier, extractor and matcher. */

export function normalize(s: string): string {
  return (s || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_\-.\[\]()*:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split camelCase / snake_case identifiers BEFORE lowercasing, for name/id attributes. */
export function humanizeIdentifier(s: string): string {
  return (s || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\-.\[\]]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function cleanLabel(s: string): string {
  return (s || '')
    .replace(/\s+/g, ' ')
    .replace(/\(\s*(required|optional)\s*\)/gi, '')
    .replace(/[*＊]+/g, '')
    .replace(/\s*:\s*$/, '')
    .trim();
}

/** Tokens split on whitespace and punctuation (incl. Devanagari danda). Works for Indic scripts. */
export function tokenize(s: string): string[] {
  return (s || '')
    .toLowerCase()
    .split(/[\s,.!?;:।॥"'()\[\]{}\-_/\\]+/u)
    .filter(Boolean);
}

export function isLatin(s: string): boolean {
  const letters = s.replace(/[^\p{L}]/gu, '');
  if (!letters) return true;
  const latin = letters.replace(/[^A-Za-zÀ-ɏ]/g, '').length;
  return latin / letters.length > 0.8;
}

export function titleCase(s: string): string {
  return s.replace(/\p{L}[\p{L}'’]*/gu, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

export function stripFillers(s: string): string {
  return s
    .replace(/\b(um+|uh+|erm|hmm+|you know|like,)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sentenceCase(s: string): string {
  const t = s.trim();
  if (!t) return t;
  const withCap = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?।]$/.test(withCap) ? withCap : withCap + '.';
}

/** Levenshtein-free cheap similarity: token overlap (Jaccard) with substring bonus. */
export function similarity(a: string, b: string): number {
  const na = normalize(a), nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ta = new Set(tokenize(na)), tb = new Set(tokenize(nb));
  let inter = 0;
  ta.forEach((t) => { if (tb.has(t)) inter++; });
  const jac = inter / (ta.size + tb.size - inter || 1);
  const sub = na.includes(nb) || nb.includes(na) ? 0.75 : 0;
  return Math.max(jac, sub);
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

export function debounce<A extends unknown[]>(fn: (...a: A) => void, ms: number): ((...a: A) => void) & { cancel(): void } {
  let t: ReturnType<typeof setTimeout> | undefined;
  const d = ((...a: A) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  }) as ((...a: A) => void) & { cancel(): void };
  d.cancel = () => { if (t) clearTimeout(t); };
  return d;
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
