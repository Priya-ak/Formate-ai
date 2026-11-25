import { isInsideFormMate } from '@/services/form/domUtils';
import { debounce } from '@/utils/text';

const CONTROL = 'input,select,textarea,[contenteditable],form,fieldset,section,.step,[data-step]';

function isRelevant(m: MutationRecord): boolean {
  const t = m.target as Element;
  if (!(t instanceof Element) || isInsideFormMate(t)) return false;
  if (m.type === 'childList') {
    const nodes = [...Array.from(m.addedNodes), ...Array.from(m.removedNodes)];
    return nodes.some((n) => n instanceof Element && (n.matches(CONTROL) || !!n.querySelector(CONTROL)));
  }
  // attribute changes (class/style/hidden) that could show or hide fields or steps
  if (m.type === 'attributes') {
    if (t.matches('input,select,textarea')) return m.attributeName !== 'value' && m.attributeName !== 'checked';
    return t.matches(CONTROL) || !!t.querySelector('input,select,textarea');
  }
  return false;
}

/** Debounced observer that only wakes the detector when form-relevant DOM changes happen. */
export function observeFormChanges(onChange: () => void, delay = 450): () => void {
  const run = debounce(onChange, delay);
  const mo = new MutationObserver((records) => { if (records.some(isRelevant)) run(); });
  mo.observe(document.documentElement, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ['class', 'style', 'hidden', 'disabled', 'aria-hidden', 'open', 'type'],
  });
  return () => { mo.disconnect(); run.cancel(); };
}
