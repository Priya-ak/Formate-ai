import type { FillResult, FormField } from '@/types/form';
import type { FieldRef } from './detector';
import { normalize, sleep } from '@/utils/text';

/**
 * Form filling engine. Works with plain HTML controls and controlled inputs of
 * React / Vue / Angular by using the native value setters and dispatching the
 * same events a real user would produce. Every fill is verified afterwards.
 */

const SETTLE_MS = 40;
const RESET_CHECK_MS = 250;

function nativeSetter(el: HTMLElement, prop: 'value' | 'checked'): ((v: unknown) => void) | undefined {
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
    : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype
    : HTMLInputElement.prototype;
  return Object.getOwnPropertyDescriptor(proto, prop)?.set as ((v: unknown) => void) | undefined;
}

function fire(el: HTMLElement, type: string, init: EventInit = {}) {
  el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true, composed: true, ...init }));
}

function fireInput(el: HTMLElement, data: string) {
  let ev: Event;
  try {
    ev = new InputEvent('input', { bubbles: true, cancelable: false, composed: true, inputType: 'insertText', data });
  } catch {
    ev = new Event('input', { bubbles: true, composed: true });
  }
  el.dispatchEvent(ev);
}

function fireKey(el: HTMLElement, type: 'keydown' | 'keyup', key: string) {
  el.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true, cancelable: true, composed: true }));
}

function focusQuiet(el: HTMLElement) {
  try { el.focus({ preventScroll: true }); } catch { /* ignore */ }
}

/** Sets a value the way frameworks expect (bypasses React's value tracker). */
export function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const setter = nativeSetter(el, 'value');
  if (setter) setter.call(el, value);
  else el.value = value;
}

function commitTextEvents(el: HTMLElement, value: string) {
  fireInput(el, value);
  fire(el, 'change');
  if (value) {
    const k = value.slice(-1);
    fireKey(el, 'keydown', k);
    fireKey(el, 'keyup', k);
  }
}

// ---------- text-like fields ----------

function fillTextLike(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  focusQuiet(el);
  setNativeValue(el, '');
  setNativeValue(el, value);
  commitTextEvents(el, value);
  el.blur();
}

export function fillTextField(el: HTMLInputElement, value: string) { fillTextLike(el, value); }
export function fillTextarea(el: HTMLTextAreaElement, value: string) { fillTextLike(el, value); }
export function fillEmailField(el: HTMLInputElement, value: string) { fillTextLike(el, value.trim()); }
export function fillPhoneField(el: HTMLInputElement, value: string) { fillTextLike(el, value.trim()); }

export function fillNumberField(el: HTMLInputElement, value: string) {
  const cleaned = String(value).replace(/[^\d.\-]/g, '');
  fillTextLike(el, cleaned);
}

/** Converts an ISO date (yyyy-mm-dd) to the format the input expects. */
export function formatDateForInput(iso: string, el: HTMLInputElement): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const [, y, mo, d] = m;
  const type = (el.type || '').toLowerCase();
  if (type === 'date') return `${y}-${mo}-${d}`;
  if (type === 'datetime-local') return `${y}-${mo}-${d}T00:00`;
  const hint = `${el.placeholder || ''} ${el.getAttribute('pattern') || ''} ${el.getAttribute('data-format') || ''}`.toLowerCase();
  const sep = /[\/\-.]/.exec(hint.replace(/yyyy|yy|dd|mm/g, ''))?.[0] ?? '/';
  const yy = hint.includes('yyyy') || !hint.includes('yy') ? y : y.slice(2);
  if (/dd.?mm/.test(hint)) return [d, mo, yy].join(sep);
  if (/mm.?dd/.test(hint)) return [mo, d, yy].join(sep);
  if (/yy.?mm/.test(hint)) return [yy, mo, d].join(sep);
  return `${y}-${mo}-${d}`;
}

export function fillDateField(el: HTMLInputElement, isoValue: string) {
  fillTextLike(el, formatDateForInput(isoValue, el));
}

export function fillContentEditable(el: HTMLElement, value: string) {
  focusQuiet(el);
  const sel = el.ownerDocument.defaultView?.getSelection();
  if (sel) {
    const range = el.ownerDocument.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
  }
  let done = false;
  try { done = el.ownerDocument.execCommand('insertText', false, value); } catch { done = false; }
  if (!done || (el.textContent || '').trim() !== value.trim()) {
    el.textContent = value;
    fireInput(el, value);
  }
  fire(el, 'change');
  el.blur();
}

// ---------- choice fields ----------

function findOption<T extends { value: string; label?: string }>(opts: T[], wanted: string): T | undefined {
  const w = normalize(wanted);
  return (
    opts.find((o) => o.value === wanted) ||
    opts.find((o) => normalize(o.value) === w) ||
    opts.find((o) => normalize(o.label || '') === w) ||
    opts.find((o) => w && normalize(o.label || '').includes(w)) ||
    undefined
  );
}

export function selectDropdownOption(el: HTMLSelectElement, wanted: string): boolean {
  const opts = Array.from(el.options).map((o) => ({ value: o.value, label: o.label || o.textContent || '', idx: o.index }));
  const match = findOption(opts, wanted);
  if (!match) return false;
  focusQuiet(el);
  el.selectedIndex = match.idx;
  setNativeValue(el, match.value);
  fire(el, 'input');
  fire(el, 'change');
  el.blur();
  return true;
}

export function fillMultiSelect(el: HTMLSelectElement, wanted: string[]): boolean {
  const opts = Array.from(el.options).map((o) => ({ value: o.value, label: o.label || o.textContent || '', idx: o.index }));
  const idxs = wanted.map((w) => findOption(opts, w)?.idx).filter((i): i is number => i !== undefined);
  if (!idxs.length) return false;
  focusQuiet(el);
  Array.from(el.options).forEach((o) => { o.selected = idxs.includes(o.index); });
  fire(el, 'input');
  fire(el, 'change');
  el.blur();
  return true;
}

function clickInput(inp: HTMLInputElement) {
  focusQuiet(inp);
  inp.click();
}

function ensureChecked(inp: HTMLInputElement, desired: boolean): boolean {
  if (inp.checked === desired) return true;
  clickInput(inp);
  if (inp.checked === desired) return true;
  // custom-styled controls: click the label instead
  const lab = inp.labels?.[0] || inp.closest('label');
  if (lab) (lab as HTMLElement).click();
  if (inp.checked === desired) return true;
  // last resort: set natively and dispatch events
  nativeSetter(inp, 'checked')?.call(inp, desired);
  fire(inp, 'input');
  fire(inp, 'change');
  return inp.checked === desired;
}

export function selectRadioOption(group: HTMLInputElement[], wanted: string): boolean {
  const opts = group.map((g, i) => ({
    value: g.value,
    label: (g.labels?.[0]?.textContent || g.closest('label')?.textContent || g.getAttribute('aria-label') || g.value || '').trim(),
    i,
  }));
  const m = findOption(opts, wanted);
  if (!m) return false;
  return ensureChecked(group[m.i], true);
}

export function toggleCheckbox(el: HTMLInputElement, desired: boolean): boolean {
  return ensureChecked(el, desired);
}

export function fillCheckboxGroup(group: HTMLInputElement[], wanted: string[]): boolean {
  const opts = group.map((g, i) => ({
    value: g.value,
    label: (g.labels?.[0]?.textContent || g.closest('label')?.textContent || g.value || '').trim(),
    i,
  }));
  const picked = new Set(wanted.map((w) => findOption(opts, w)?.i).filter((i): i is number => i !== undefined));
  if (!picked.size) return false;
  let ok = true;
  group.forEach((g, i) => { if (!ensureChecked(g, picked.has(i))) ok = false; });
  return ok;
}

// ---------- verification ----------

function digits(s: string) { return s.replace(/\D/g, ''); }

export function valuesMatch(expected: string, actual: string, kind: FormField['inputType']): boolean {
  if (expected === actual) return true;
  if (kind === 'tel' || kind === 'number') return digits(expected) === digits(actual);
  if (kind === 'date') return digits(expected) === digits(actual) || normalize(expected) === normalize(actual);
  return normalize(expected) === normalize(actual);
}

export function readValue(ref: FieldRef, kind: FormField['inputType']): FormField['value'] {
  const el = ref.el;
  switch (kind) {
    case 'radio': return ref.group?.find((g) => g.checked)?.value ?? '';
    case 'checkbox-group': return (ref.group || []).filter((g) => g.checked).map((g) => g.value);
    case 'checkbox': return (el as HTMLInputElement).checked;
    case 'multiselect': return Array.from((el as HTMLSelectElement).selectedOptions).map((o) => o.value);
    case 'select': return (el as HTMLSelectElement).value;
    case 'contenteditable': return (el.textContent || '').trim();
    case 'file': return (el as HTMLInputElement).files?.length ? 'file' : '';
    default: return (el as HTMLInputElement).value;
  }
}

export function verifyFieldValue(ref: FieldRef, field: FormField, expected: string | string[] | boolean): { ok: boolean; actual: FormField['value'] } {
  const actual = readValue(ref, field.inputType);
  if (typeof expected === 'boolean') return { ok: actual === expected, actual };
  if (Array.isArray(expected)) {
    const a = Array.isArray(actual) ? actual : [String(actual)];
    const exp = field.options.length ? expected.map((e) => findOption(field.options, e)?.value ?? e) : expected;
    return { ok: exp.every((e) => a.includes(e)), actual };
  }
  if (field.inputType === 'select' || field.inputType === 'radio') {
    const opt = findOption(field.options, expected);
    const target = opt?.value ?? expected;
    return { ok: String(actual) === target || normalize(String(actual)) === normalize(target), actual };
  }
  return { ok: valuesMatch(String(expected), String(actual), field.inputType), actual };
}

/** Looks for the validation message a website shows for this control. */
export function detectValidationError(ref: FieldRef, opts: { skipEmpty?: boolean } = {}): string | undefined {
  const el = ref.group ? ref.group[0] : ref.el;
  const doc = el.ownerDocument;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    if (opts.skipEmpty && !el.value) return undefined;
    if (!el.checkValidity()) return el.validationMessage || 'This value is not accepted by the form.';
  }
  const invalid = el.getAttribute('aria-invalid') === 'true' || el.classList.contains('is-invalid') || el.classList.contains('error');
  const idsMsg = ['aria-errormessage', 'aria-describedby']
    .map((a) => el.getAttribute(a))
    .filter(Boolean)
    .flatMap((v) => (v as string).split(/\s+/))
    .map((id) => doc.getElementById(id)?.textContent?.trim() || '')
    .find((t) => t && invalid);
  if (idsMsg) return idsMsg;
  const sel = '.error,.error-message,.invalid-feedback,.field-error,[role="alert"],.help-block.error,[class*="error"]';
  let p: HTMLElement | null = el.parentElement;
  for (let i = 0; p && i < 2; i++, p = p.parentElement) {
    const m = Array.from(p.querySelectorAll(sel)).find((n) => !n.contains(el) && (n.textContent || '').trim() && (n as HTMLElement).offsetParent !== null || (n.textContent || '').trim() && invalid);
    if (m && (invalid || (m as HTMLElement).offsetParent !== null || !m.ownerDocument.defaultView?.getComputedStyle(m).display.includes('none'))) {
      const t = (m.textContent || '').trim();
      if (t && !m.hasAttribute('hidden') && m.ownerDocument.defaultView?.getComputedStyle(m).display !== 'none') return t;
    }
  }
  return undefined;
}

// ---------- dispatcher ----------

export async function fillField(ref: FieldRef, field: FormField, value: string | string[] | boolean): Promise<FillResult> {
  const base = { fieldId: field.fieldId };
  try {
    if (field.manualOnly || (ref.el instanceof HTMLInputElement && ref.el.type === 'password')) {
      return { ...base, ok: false, error: 'This field is sensitive. Please fill it yourself.' };
    }
    if (field.inputType === 'file') return { ...base, ok: false, error: 'File uploads must be chosen by you.' };
    if (field.disabled || field.readOnly) return { ...base, ok: false, error: 'This field is read-only or disabled.' };
    if (!ref.el.isConnected) return { ...base, ok: false, error: 'This field is no longer on the page.' };

    const el = ref.el;
    let applied = true;
    switch (field.inputType) {
      case 'text': case 'url': fillTextField(el as HTMLInputElement, String(value)); break;
      case 'email': fillEmailField(el as HTMLInputElement, String(value)); break;
      case 'tel': fillPhoneField(el as HTMLInputElement, String(value)); break;
      case 'number': fillNumberField(el as HTMLInputElement, String(value)); break;
      case 'date': case 'time': fillDateField(el as HTMLInputElement, String(value)); break;
      case 'textarea': fillTextarea(el as HTMLTextAreaElement, String(value)); break;
      case 'contenteditable': fillContentEditable(el, String(value)); break;
      case 'select': applied = selectDropdownOption(el as HTMLSelectElement, String(value)); break;
      case 'multiselect': applied = fillMultiSelect(el as HTMLSelectElement, ([] as string[]).concat(value as string[] | string)); break;
      case 'radio': applied = selectRadioOption(ref.group || [el as HTMLInputElement], String(value)); break;
      case 'checkbox': applied = toggleCheckbox(el as HTMLInputElement, value === true || value === 'true'); break;
      case 'checkbox-group': applied = fillCheckboxGroup(ref.group || [], ([] as string[]).concat(value as string[] | string)); break;
      default: return { ...base, ok: false, error: 'This kind of field is not supported.' };
    }
    if (!applied) return { ...base, ok: false, error: 'No matching option was found on the page.' };

    await sleep(SETTLE_MS);
    let check = verifyFieldValue(ref, field, value);
    if (!check.ok && ['text', 'textarea', 'email', 'tel', 'url', 'number'].includes(field.inputType)) {
      // retry once through the editing pipeline (some masked inputs need execCommand)
      const t = el as HTMLInputElement;
      focusQuiet(t);
      t.select?.();
      try { el.ownerDocument.execCommand('insertText', false, String(value)); } catch { /* ignore */ }
      await sleep(SETTLE_MS);
      check = verifyFieldValue(ref, field, value);
    }
    if (!check.ok) {
      return { ...base, ok: false, actual: check.actual, error: 'The website did not accept the value.', validationError: detectValidationError(ref) };
    }
    await sleep(RESET_CHECK_MS);
    const again = verifyFieldValue(ref, field, value);
    if (!again.ok) {
      return { ...base, ok: false, actual: again.actual, resetByPage: true, error: 'The website changed the value back after I filled it.' };
    }
    return { ...base, ok: true, actual: again.actual, validationError: detectValidationError(ref, { skipEmpty: true }) };
  } catch (e) {
    return { ...base, ok: false, error: e instanceof Error ? e.message : 'Unexpected error while filling.' };
  }
}
