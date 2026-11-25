import type { FieldOption, FormField, FormSchema, InputKind, StepInfo } from '@/types/form';
import { classifyField, guessFormKind, refineFileType, type FieldSignals } from './fieldClassifier';
import { isInsideFormMate, isVisible, rawLabelHasRequiredMark, textOfIds, textWithoutControls } from './domUtils';
import { cleanLabel, humanizeIdentifier, normalize, titleCase } from '@/utils/text';

export type FieldElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLElement;

export interface FieldRef {
  el: FieldElement;
  /** For radio groups / checkbox groups. */
  group?: HTMLInputElement[];
}

export interface DetectionResult {
  schema: FormSchema;
  refs: Map<string, FieldRef>;
  root: Element;
}

const IGNORED_INPUT_TYPES = new Set(['hidden', 'submit', 'button', 'image', 'reset', 'search', 'password', 'color', 'range', 'month', 'week']);
const idMap = new WeakMap<Element, string>();
let idCounter = 0;

export function elementId(el: Element): string {
  let id = idMap.get(el);
  if (!id) {
    id = `field_${String(++idCounter).padStart(3, '0')}`;
    idMap.set(el, id);
  }
  return id;
}

// ---------- labels ----------

function labelTextFor(el: HTMLElement): { text: string; raw: string } {
  const doc = el.ownerDocument;
  let raw = '';
  const labels = (el as HTMLInputElement).labels;
  if (labels && labels.length) {
    raw = Array.from(labels).map((l) => textWithoutControls(l)).join(' ');
  }
  if (!raw) raw = textOfIds(doc, el.getAttribute('aria-labelledby'));
  if (!raw) raw = el.getAttribute('aria-label') || '';
  if (!raw) {
    const wrap = el.closest('label');
    if (wrap) raw = textWithoutControls(wrap);
  }
  return { text: cleanLabel(raw), raw };
}

const LABELISH = 'label, legend, .label, .form-label, .control-label, [class*="label"], strong, b, h3, h4, h5, h6, p, span';

function nearbyLabel(el: HTMLElement, root: Element): string {
  // 1) previous element sibling that looks like a label
  let sib: Element | null = el.previousElementSibling;
  for (let i = 0; sib && i < 2; i++, sib = sib.previousElementSibling) {
    if (sib.matches('input,select,textarea,button')) break;
    const t = textWithoutControls(sib);
    if (t && t.length <= 90) return t;
  }
  // 2) first label-like child of the wrapper (form-group style)
  let p: HTMLElement | null = el.parentElement;
  for (let depth = 0; p && depth < 3 && p !== root; depth++, p = p.parentElement) {
    const controls = p.querySelectorAll('input:not([type=hidden]),select,textarea').length;
    if (controls > 1) break;
    const cand = Array.from(p.querySelectorAll(LABELISH)).find((c) => {
      if (c.contains(el)) return false;
      const pos = c.compareDocumentPosition(el);
      return !!(pos & Node.DOCUMENT_POSITION_FOLLOWING) && textWithoutControls(c).length > 0 && textWithoutControls(c).length <= 90;
    });
    if (cand) return textWithoutControls(cand);
  }
  return '';
}

function groupLabel(els: HTMLInputElement[], root: Element): { text: string; raw: string } {
  const first = els[0];
  const fs = first.closest('fieldset');
  if (fs) {
    const lg = fs.querySelector(':scope > legend');
    if (lg) { const t = textWithoutControls(lg); return { text: cleanLabel(t), raw: t }; }
  }
  const rg = first.closest('[role="radiogroup"],[role="group"]');
  if (rg) {
    const t = textOfIds(first.ownerDocument, rg.getAttribute('aria-labelledby')) || rg.getAttribute('aria-label') || '';
    if (t) return { text: cleanLabel(t), raw: t };
  }
  // Walk up until an ancestor contains all inputs, then take the first label-like text that is not an option label.
  const optionLabels = new Set<Element>();
  els.forEach((e) => { ((e as HTMLInputElement).labels || []) && Array.from((e as HTMLInputElement).labels || []).forEach((l) => optionLabels.add(l)); const w = e.closest('label'); if (w) optionLabels.add(w); });
  let anc: HTMLElement | null = first.parentElement;
  for (let i = 0; anc && i < 5 && anc !== root; i++, anc = anc.parentElement) {
    if (!els.every((e) => anc!.contains(e))) continue;
    const cand = Array.from(anc.querySelectorAll(LABELISH)).find((c) => {
      if (optionLabels.has(c) || Array.from(optionLabels).some((o) => o.contains(c) || c.contains(first))) return false;
      const t = textWithoutControls(c);
      return t.length > 0 && t.length <= 90 && !!(c.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    if (cand) { const t = textWithoutControls(cand); return { text: cleanLabel(t), raw: t }; }
  }
  return { text: '', raw: '' };
}

function sectionOf(el: Element, root: Element): string {
  const fs = el.closest('fieldset');
  // Fieldset legend only if it is a section (contains more than this one group)
  if (fs && fs !== root) {
    const lg = fs.querySelector(':scope > legend');
    const nCtl = fs.querySelectorAll('input:not([type=hidden]),select,textarea').length;
    if (lg && nCtl > 1) return cleanLabel(textWithoutControls(lg));
  }
  let node: Element | null = el;
  while (node && node !== root && node.parentElement) {
    const secEl: Element | null = node.closest('section,[data-section],[role="group"],.step,.form-section,.section');
    if (!secEl || secEl === root) break;
    const aria = secEl.getAttribute('aria-label') || textOfIds(el.ownerDocument, secEl.getAttribute('aria-labelledby')) || secEl.getAttribute('data-section');
    if (aria) return cleanLabel(aria);
    const h = secEl.querySelector('h1,h2,h3,h4,legend,.section-title');
    if (h && !h.contains(el)) return cleanLabel(textWithoutControls(h));
    node = secEl.parentElement;
  }
  // nearest preceding heading
  let cur: Element | null = el;
  for (let i = 0; cur && i < 6; i++) {
    let sib: Element | null = cur.previousElementSibling;
    while (sib) {
      if (/^H[1-6]$/.test(sib.tagName)) return cleanLabel(textWithoutControls(sib));
      const h = sib.querySelector?.('h1,h2,h3,h4');
      if (h && !sib.querySelector('input,select,textarea')) return cleanLabel(textWithoutControls(h));
      sib = sib.previousElementSibling;
    }
    cur = cur.parentElement;
    if (!cur || cur === root) break;
  }
  return '';
}

function helpTextOf(el: HTMLElement): string {
  const d = textOfIds(el.ownerDocument, el.getAttribute('aria-describedby'));
  if (d) return d;
  const sib = el.nextElementSibling;
  if (sib && sib.matches('small,.help,.hint,.help-text,.form-text,.description') ) return textWithoutControls(sib);
  return '';
}

// ---------- eligibility ----------

function isSearchLike(el: HTMLElement): boolean {
  if (el.closest('[role="search"]')) return true;
  const t = normalize(`${el.getAttribute('name') || ''} ${el.id} ${el.getAttribute('placeholder') || ''} ${el.getAttribute('aria-label') || ''}`);
  return /^(q|s|search|query|keyword)\b|\bsearch\b/.test(t) && (el as HTMLInputElement).type !== 'email';
}

function isCaptchaLike(el: HTMLElement): boolean {
  const t = normalize(`${el.getAttribute('name') || ''} ${el.id} ${el.className && typeof el.className === 'string' ? el.className : ''}`);
  return /captcha|g recaptcha response|h captcha/.test(t) || !!el.closest('.g-recaptcha,.h-captcha,[data-sitekey]');
}

function eligibleControls(root: Element): HTMLElement[] {
  const out: HTMLElement[] = [];
  root.querySelectorAll('input,textarea,select,[contenteditable="true"],[contenteditable=""],[role="textbox"][contenteditable]').forEach((n) => {
    const el = n as HTMLElement;
    if (isInsideFormMate(el)) return;
    if (el instanceof HTMLInputElement) {
      const t = (el.type || 'text').toLowerCase();
      if (IGNORED_INPUT_TYPES.has(t)) return;
    }
    if (isCaptchaLike(el)) return;
    if (isSearchLike(el)) return;
    // contenteditable that is a child of another contenteditable is not separate
    if (el.isContentEditable && !(el instanceof HTMLInputElement) && el.parentElement?.closest('[contenteditable="true"]')) return;
    if (!(el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) && !isVisible(el)) return;
    if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
      // custom-styled checkboxes are often visually hidden; accept if their label is visible
      const lab = el.labels?.[0] || el.closest('label');
      if (!isVisible(el) && !(lab && isVisible(lab))) return;
    }
    out.push(el);
  });
  return out;
}

function countUnsupported(root: Element): number {
  let n = 0;
  root.querySelectorAll('[role="combobox"]:not(input):not(select),[role="listbox"],[role="slider"],[role="switch"],.select2-container,[class*="MuiSelect"],[class*="react-select"]').forEach((e) => {
    if (!isInsideFormMate(e) && isVisible(e)) n++;
  });
  root.ownerDocument.querySelectorAll('iframe[src]').forEach((f) => {
    if (/forms|typeform|jotform|airtable|hubspot|formstack|wufoo/i.test(f.getAttribute('src') || '')) n++;
  });
  return n;
}

// ---------- extraction ----------

function inputKind(el: HTMLElement): InputKind {
  if (el instanceof HTMLSelectElement) return el.multiple ? 'multiselect' : 'select';
  if (el instanceof HTMLTextAreaElement) return 'textarea';
  if (el instanceof HTMLInputElement) {
    switch ((el.type || 'text').toLowerCase()) {
      case 'email': return 'email';
      case 'tel': return 'tel';
      case 'number': return 'number';
      case 'date': case 'datetime-local': return 'date';
      case 'time': return 'time';
      case 'url': return 'url';
      case 'checkbox': return 'checkbox';
      case 'radio': return 'radio';
      case 'file': return 'file';
      default: return 'text';
    }
  }
  return 'contenteditable';
}

function optionLabelOf(inp: HTMLInputElement): string {
  const l = inp.labels?.[0] || inp.closest('label');
  const t = l ? textWithoutControls(l) : '';
  return t || inp.getAttribute('aria-label') || inp.value;
}

function currentValue(kind: InputKind, el: HTMLElement, group?: HTMLInputElement[]): FormField['value'] {
  if (kind === 'radio' && group) return group.find((g) => g.checked)?.value ?? '';
  if (kind === 'checkbox-group' && group) return group.filter((g) => g.checked).map((g) => g.value);
  if (kind === 'checkbox') return (el as HTMLInputElement).checked;
  if (kind === 'multiselect') return Array.from((el as HTMLSelectElement).selectedOptions).map((o) => o.value);
  if (kind === 'select') {
    const s = el as HTMLSelectElement;
    const o = s.selectedOptions[0];
    return o && o.value !== '' && !o.disabled ? s.value : '';
  }
  if (kind === 'file') return (el as HTMLInputElement).files && (el as HTMLInputElement).files!.length ? Array.from((el as HTMLInputElement).files!).map((f) => f.name).join(', ') : '';
  if (kind === 'contenteditable') return (el.textContent || '').trim();
  return (el as HTMLInputElement).value || '';
}

function isEmptyValue(v: FormField['value']): boolean {
  return v === '' || v === false || (Array.isArray(v) && v.length === 0);
}

export function buildFieldFromElement(
  el: HTMLElement, root: Element, group: HTMLInputElement[] | undefined, order: number,
): { field: FormField; ref: FieldRef } {
  const inGroup = !!group && group.length > 0;
  let kind = inputKind(el);
  if (inGroup && kind === 'checkbox' && group!.length > 1) kind = 'checkbox-group';

  const lab = inGroup && group!.length > 1 ? groupLabel(group!, root) : labelTextFor(el);
  let labelText = lab.text;
  let rawLabel = lab.raw;
  if (!labelText && kind === 'checkbox') {
    // single checkbox with text right after it
    const near = el.nextSibling && el.nextSibling.textContent ? cleanLabel(el.nextSibling.textContent) : '';
    labelText = near; rawLabel = near;
  }
  if (!labelText) { const n = nearbyLabel(el, root); labelText = cleanLabel(n); rawLabel = n; }
  const placeholder = el.getAttribute('placeholder') || '';
  if (!labelText) labelText = cleanLabel(el.getAttribute('title') || '') || cleanLabel(placeholder);
  const name = el.getAttribute('name') || '';
  if (!labelText) labelText = titleCase(humanizeIdentifier(name || el.id));

  const section = sectionOf(el, root);
  const help = helpTextOf(el);
  const htmlType = el instanceof HTMLInputElement ? (el.type || 'text').toLowerCase() : el instanceof HTMLTextAreaElement ? 'textarea' : el instanceof HTMLSelectElement ? 'select' : 'contenteditable';

  const signals: FieldSignals = {
    autocomplete: el.getAttribute('autocomplete') || '',
    htmlType,
    name, id: el.id,
    label: labelText,
    ariaLabel: el.getAttribute('aria-label') || '',
    placeholder,
    context: `${section} ${help}`,
    isCheckbox: kind === 'checkbox',
    isRadio: kind === 'radio',
    isSelect: kind === 'select' || kind === 'multiselect',
  };
  let cls = classifyField(signals);
  if (kind === 'file') cls = refineFileType(cls, `${labelText} ${name} ${el.id}`);

  let options: FieldOption[] = [];
  if (el instanceof HTMLSelectElement) {
    options = Array.from(el.options)
      .filter((o) => !(o.value === '' && o.index === 0))
      .map((o) => ({ value: o.value, label: cleanLabel(o.label || o.textContent || o.value), disabled: o.disabled }))
      .filter((o) => o.label && !/^(-+\s*)?(select|choose|please select)\b/i.test(o.label));
  } else if (inGroup && (kind === 'radio' || kind === 'checkbox-group')) {
    options = group!.map((g) => ({ value: g.value, label: optionLabelOf(g), disabled: g.disabled }));
  }

  const value = currentValue(kind, el, group);
  const required =
    (el as HTMLInputElement).required === true ||
    (inGroup && group!.some((g) => g.required)) ||
    el.getAttribute('aria-required') === 'true' ||
    rawLabelHasRequiredMark(rawLabel);

  const disabled = (el as HTMLInputElement).disabled === true;
  const readOnly = (el as HTMLInputElement).readOnly === true || el.getAttribute('aria-readonly') === 'true';
  const prefilled = !isEmptyValue(value);
  const input = el as HTMLInputElement;
  const mlen = (a: number) => (a > 0 ? a : undefined);

  let status: FormField['status'] = 'pending';
  if (cls.manualOnly || kind === 'file') status = 'needs_attention';
  if (disabled || readOnly) status = 'skipped';
  else if (prefilled && !cls.manualOnly && kind !== 'file') status = 'filled';

  const id = elementId(group && group.length ? group[0] : el);
  const field: FormField = {
    fieldId: id,
    label: labelText || 'Field',
    semanticType: cls.type,
    inputType: kind,
    required,
    value,
    placeholder,
    options,
    section,
    status,
    confidence: cls.confidence,
    classifiedBy: cls.by,
    sensitive: cls.sensitive,
    manualOnly: cls.manualOnly,
    legal: cls.legal,
    name, htmlId: el.id,
    helpText: help,
    min: input.min || undefined, max: input.max || undefined,
    minLength: mlen(input.minLength ?? -1), maxLength: mlen(input.maxLength ?? -1),
    pattern: input.pattern || undefined, step: input.step || undefined,
    multiple: kind === 'multiselect' || kind === 'checkbox-group',
    disabled, readOnly, prefilled, orderIndex: order,
    key: '',
  };
  return { field, ref: { el, group } };
}

// ---------- form-level ----------

function collectFields(root: Element): { fields: FormField[]; refs: Map<string, FieldRef> } {
  const controls = eligibleControls(root);
  const fields: FormField[] = [];
  const refs = new Map<string, FieldRef>();
  const seenGroups = new Set<string>();
  const keyCounts = new Map<string, number>();
  let order = 0;

  const radiosByName = new Map<string, HTMLInputElement[]>();
  const checksByName = new Map<string, HTMLInputElement[]>();
  controls.forEach((c) => {
    if (c instanceof HTMLInputElement && c.name) {
      if (c.type === 'radio') radiosByName.set(c.name, [...(radiosByName.get(c.name) || []), c]);
      if (c.type === 'checkbox') checksByName.set(c.name, [...(checksByName.get(c.name) || []), c]);
    }
  });

  for (const c of controls) {
    let group: HTMLInputElement[] | undefined;
    if (c instanceof HTMLInputElement && c.type === 'radio') {
      group = c.name ? radiosByName.get(c.name) : [c];
      const gk = `r:${c.name || elementId(c)}`;
      if (seenGroups.has(gk)) continue;
      seenGroups.add(gk);
    } else if (c instanceof HTMLInputElement && c.type === 'checkbox' && c.name && (checksByName.get(c.name)?.length || 0) > 1) {
      group = checksByName.get(c.name);
      const gk = `c:${c.name}`;
      if (seenGroups.has(gk)) continue;
      seenGroups.add(gk);
    }
    const { field, ref } = buildFieldFromElement(group ? group[0] : c, root, group, order++);
    const base = `${field.semanticType}|${normalize(field.label)}|${field.name}`;
    const n = (keyCounts.get(base) || 0) + 1;
    keyCounts.set(base, n);
    field.key = n > 1 ? `${base}#${n}` : base;
    fields.push(field);
    refs.set(field.fieldId, ref);
  }
  return { fields, refs };
}

function detectStep(root: Element): StepInfo {
  const doc = root.ownerDocument;
  const info: StepInfo = { isMultiStep: false };
  const textScope = (root === doc.body ? doc.body : root.parentElement || root);
  const text = (textScope.textContent || '').slice(0, 6000);
  const m = /step\s*(\d+)\s*(?:of|\/)\s*(\d+)/i.exec(text);
  if (m) {
    info.isMultiStep = true; info.current = +m[1]; info.total = +m[2];
  } else {
    const stepper = textScope.querySelector('.stepper,.steps,[class*="stepper"],[class*="step-indicator"],ol.progress,[role="progressbar"]');
    const kids = stepper ? Array.from(stepper.children) : [];
    if (kids.length > 1) {
      info.isMultiStep = true; info.total = kids.length;
      const idx = kids.findIndex((k) => /active|current/.test(String((k as HTMLElement).className)) || k.getAttribute('aria-current') === 'step');
      if (idx >= 0) info.current = idx + 1;
    }
  }
  const buttons = Array.from(root.querySelectorAll('button,input[type=button],input[type=submit],a[role=button]')) as HTMLElement[];
  const labelOf = (b: HTMLElement) => cleanLabel((b as HTMLInputElement).value || b.textContent || '');
  const next = buttons.find((b) => isVisible(b) && /^(next|continue|save (and|&) (continue|next)|proceed)\b/i.test(labelOf(b)));
  const prev = buttons.find((b) => isVisible(b) && /^(previous|back)\b/i.test(labelOf(b)));
  if (next) { info.nextLabel = labelOf(next); info.isMultiStep = true; }
  if (prev) { info.prevLabel = labelOf(prev); info.isMultiStep = true; }
  return info;
}

function formTitle(root: Element, doc: Document): string {
  if (root instanceof HTMLElement) {
    const a = root.getAttribute('aria-label') || textOfIds(doc, root.getAttribute('aria-labelledby'));
    if (a) return cleanLabel(a);
    const h = root.querySelector('h1,h2');
    if (h) return cleanLabel(textWithoutControls(h));
  }
  let sib: Element | null = root.previousElementSibling;
  for (let i = 0; sib && i < 3; i++, sib = sib.previousElementSibling) {
    if (/^H[1-3]$/.test(sib.tagName)) return cleanLabel(textWithoutControls(sib));
  }
  const h1 = doc.querySelector('h1');
  if (h1) return cleanLabel(textWithoutControls(h1));
  return cleanLabel(doc.title) || doc.location?.hostname || 'Form';
}

/** Decide whether a candidate container is a real "application" form rather than search/newsletter/login. */
export function isIgnoredForm(root: Element, fields: FormField[]): boolean {
  if (fields.length === 0) return true;
  if (root instanceof HTMLElement && (root.getAttribute('role') === 'search' || /search/i.test(root.getAttribute('action') || ''))) return true;
  const hasPassword = !!root.querySelector('input[type=password]');
  const real = fields.filter((f) => !f.manualOnly);
  if (hasPassword && real.length <= 3) return true; // login / signup-lite forms
  const onlyEmail = real.length === 1 && real[0].semanticType === 'email';
  if (onlyEmail) return true; // newsletter
  return real.length < 2 && !real.some((f) => f.required);
}

export function detectBestForm(doc: Document = document, opts: { includeLogin?: boolean } = {}): DetectionResult | null {
  const candidates: { root: Element; fields: FormField[]; refs: Map<string, FieldRef> }[] = [];
  const seen = new Set<Element>();
  doc.querySelectorAll('form,[role="form"]').forEach((f) => {
    if (isInsideFormMate(f) || seen.has(f)) return;
    seen.add(f);
    const { fields, refs } = collectFields(f);
    if (opts.includeLogin ? fields.length > 0 : !isIgnoredForm(f, fields)) candidates.push({ root: f, fields, refs });
  });
  // controls outside any <form> (common in SPAs)
  const orphans = Array.from(doc.querySelectorAll('input,textarea,select')).filter((e) => !e.closest('form,[role="form"]') && !isInsideFormMate(e));
  if (orphans.length >= 3 && doc.body) {
    const { fields, refs } = collectFields(doc.body);
    const orphanFields = fields.filter((f) => refs.get(f.fieldId) && !(refs.get(f.fieldId)!.el.closest('form,[role="form"]')));
    if (orphanFields.length >= 3 && !isIgnoredForm(doc.body, orphanFields)) {
      const orphanRefs = new Map<string, FieldRef>();
      orphanFields.forEach((f) => orphanRefs.set(f.fieldId, refs.get(f.fieldId)!));
      candidates.push({ root: doc.body, fields: orphanFields, refs: orphanRefs });
    }
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.fields.length - a.fields.length);
  const best = candidates[0];
  best.fields.forEach((f, i) => { f.orderIndex = i; });
  const headingText = Array.from(doc.querySelectorAll('h1,h2')).slice(0, 4).map((h) => h.textContent || '').join(' ');
  const title = formTitle(best.root, doc);
  const schema: FormSchema = {
    formId: `form_${normalize(title).replace(/\s+/g, '_').slice(0, 24) || 'main'}`,
    title,
    host: doc.location?.hostname || '',
    url: doc.location?.href || '',
    kind: guessFormKind(`${title} ${headingText} ${doc.title} ${doc.location?.pathname || ''} ${best.fields.map((f) => f.label).join(' ')}`),
    fields: best.fields,
    step: detectStep(best.root),
    hasCaptcha: !!best.root.querySelector('.g-recaptcha,.h-captcha,[data-sitekey],iframe[src*="recaptcha"],iframe[src*="hcaptcha"]') || !!doc.querySelector('.g-recaptcha,.h-captcha'),
    unsupportedCount: countUnsupported(best.root),
    detectedAt: Date.now(),
  };
  return { schema, refs: best.refs, root: best.root };
}

/** Cheap signature to avoid re-emitting identical schemas. */
export function schemaSignature(s: FormSchema | null): string {
  if (!s) return 'none';
  return s.fields.map((f) => `${f.key}:${f.options.length}:${f.required ? 1 : 0}:${f.disabled ? 1 : 0}`).join('|') + `#${s.step.current ?? ''}/${s.step.total ?? ''}`;
}
