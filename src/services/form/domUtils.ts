import { cleanLabel } from '@/utils/text';

const FM_HOST_ID = 'formmate-root';

export function isInsideFormMate(el: Element): boolean {
  return !!el.closest(`#${FM_HOST_ID}`);
}

function hasLayout(doc: Document): boolean {
  return doc.documentElement.getBoundingClientRect().width > 0;
}

/** Visibility check that works in real browsers and degrades gracefully in jsdom (no layout). */
export function isVisible(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const doc = el.ownerDocument;
  const win = doc.defaultView;
  if (!win) return false;
  let node: HTMLElement | null = el;
  while (node) {
    if (node.hidden || node.getAttribute('aria-hidden') === 'true' || node.hasAttribute('inert')) return false;
    const cs = win.getComputedStyle(node);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') return false;
    node = node.parentElement;
  }
  if (hasLayout(doc)) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    // Honeypot-style fields parked far off-screen.
    if (r.right < -500 || r.bottom < -500 || r.left > win.innerWidth + 5000) return false;
  }
  return true;
}

/** Text content of an element excluding form controls inside it. */
export function textWithoutControls(el: Element): string {
  const clone = el.cloneNode(true) as Element;
  clone.querySelectorAll('input,select,textarea,button,script,style,svg').forEach((n) => n.remove());
  return cleanLabel(clone.textContent || '');
}

export function textOfIds(doc: Document, ids: string | null): string {
  if (!ids) return '';
  return ids
    .split(/\s+/)
    .map((id) => doc.getElementById(id))
    .filter((n): n is HTMLElement => !!n)
    .map((n) => textWithoutControls(n))
    .join(' ')
    .trim();
}

export function rawLabelHasRequiredMark(text: string): boolean {
  return /[*＊]|\(\s*required\s*\)|\brequired\b/i.test(text);
}

export const FM_ROOT_ID = FM_HOST_ID;
