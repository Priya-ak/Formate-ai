import { detectBestForm, schemaSignature, type DetectionResult } from '@/services/form/detector';
import type { FormSchema } from '@/types/form';
import { debounce } from '@/utils/text';
import { observeFormChanges } from './mutationObserver';

export type ChangeReason = 'mutation' | 'navigation' | 'step' | 'initial';

/** Keeps the latest detection result and notifies listeners only when the form really changed. */
export class FormWatcher {
  private current: DetectionResult | null = null;
  private lastSig = 'none';
  private lastHref = location.href;
  private stops: Array<() => void> = [];
  private listeners = new Set<(schema: FormSchema | null, reason: ChangeReason) => void>();
  private pendingReason: ChangeReason = 'mutation';

  get result(): DetectionResult | null { return this.current; }
  get schema(): FormSchema | null { return this.current?.schema ?? null; }

  onChange(fn: (schema: FormSchema | null, reason: ChangeReason) => void) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  scan(reason: ChangeReason = 'mutation', force = false): FormSchema | null {
    const prevStep = this.current?.schema.step.current;
    this.current = detectBestForm(document);
    const schema = this.current?.schema ?? null;
    const sig = schemaSignature(schema);
    if (force || sig !== this.lastSig) {
      const stepChanged = schema?.step.current !== undefined && schema.step.current !== prevStep && prevStep !== undefined;
      this.lastSig = sig;
      const r: ChangeReason = reason === 'mutation' && stepChanged ? 'step' : reason;
      this.listeners.forEach((l) => l(schema, r));
    }
    return schema;
  }

  start() {
    const debounced = debounce(() => this.scan(this.pendingReason), 300);
    const schedule = (r: ChangeReason = 'mutation') => { this.pendingReason = r; debounced(); };
    this.scan('initial', true);
    this.stops.push(observeFormChanges(() => schedule('mutation')));

    // clicks on Next/Previous-like controls change the visible step shortly after
    const onClick = (e: MouseEvent) => {
      const b = (e.target as Element | null)?.closest?.('button,input[type=button],input[type=submit],a[role=button]');
      if (b && /next|continue|previous|back|proceed|step/i.test(`${b.textContent} ${(b as HTMLInputElement).value || ''}`)) {
        window.setTimeout(() => schedule('step'), 250);
        window.setTimeout(() => schedule('step'), 900);
      }
    };
    document.addEventListener('click', onClick, true);
    this.stops.push(() => document.removeEventListener('click', onClick, true));

    // SPA navigation
    const nav = () => { if (location.href !== this.lastHref) { this.lastHref = location.href; schedule('navigation'); } };
    window.addEventListener('popstate', nav);
    window.addEventListener('hashchange', nav);
    const w = window as unknown as { navigation?: EventTarget };
    w.navigation?.addEventListener('navigatesuccess', nav);
    const poll = window.setInterval(nav, 1500);
    this.stops.push(() => {
      window.removeEventListener('popstate', nav); window.removeEventListener('hashchange', nav);
      w.navigation?.removeEventListener('navigatesuccess', nav); window.clearInterval(poll); debounced.cancel();
    });
    document.addEventListener('DOMContentLoaded', () => schedule('initial'), { once: true });
  }

  stop() { this.stops.forEach((s) => s()); this.stops = []; this.listeners.clear(); }
}
