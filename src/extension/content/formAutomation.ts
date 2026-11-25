import { fillField, readValue } from '@/services/form/automation';
import { detectValidationError } from '@/services/form/automation';
import type { FillResult, FormField } from '@/types/form';
import type { ContentCommand } from '@/types/session';
import type { FormWatcher } from './formDetector';
import { FieldHighlighter } from './fieldHighlighter';
import { getShadowRoot } from './shadowHost';

/** Executes commands from the side panel against the live page. */
export class FormAutomation {
  private hl = new FieldHighlighter();
  private reduceMotion = false;
  constructor(private watcher: FormWatcher) {}

  setReducedMotion(v: boolean) { this.reduceMotion = v; }

  private find(fieldId: string): { field: FormField; ref: NonNullable<FormWatcher['result']>['refs'] extends Map<string, infer R> ? R : never } | null {
    const res = this.watcher.result;
    if (!res) return null;
    const ref = res.refs.get(fieldId);
    const field = res.schema.fields.find((f) => f.fieldId === fieldId);
    return ref && field ? { field, ref } : null;
  }

  async handle(cmd: ContentCommand): Promise<unknown> {
    switch (cmd.type) {
      case 'FM_PING': return { ok: true, hasForm: !!this.watcher.schema };
      case 'FM_SCAN': return { schema: this.watcher.scan('initial', !!cmd.force) ?? this.watcher.schema };
      case 'FM_FILL': return this.fill(cmd.fieldId, cmd.value);
      case 'FM_HIGHLIGHT': {
        const f = this.find(cmd.fieldId);
        if (f) this.hl.show(f.ref, f.field.label, { scroll: cmd.scroll, reduceMotion: this.reduceMotion });
        return { ok: !!f };
      }
      case 'FM_CLEAR_HIGHLIGHT': this.hl.clear(); return { ok: true };
      case 'FM_READ_VALUES': {
        const res = this.watcher.result;
        const out: Record<string, FormField['value']> = {};
        res?.schema.fields.forEach((f) => { const r = res.refs.get(f.fieldId); if (r) out[f.fieldId] = readValue(r, f.inputType); });
        return { values: out };
      }
      case 'FM_SHOW_NOTICE': this.notice(cmd.text); return { ok: true };
      default: return { ok: false, error: 'unknown command' };
    }
  }

  private async fill(fieldId: string, value: string | string[] | boolean): Promise<FillResult> {
    const f = this.find(fieldId);
    if (!f) return { ok: false, fieldId, error: 'This field is no longer on the page.' };
    const res = await fillField(f.ref, f.field, value);
    if (res.ok) this.hl.flashDone(f.ref, f.field.label, this.reduceMotion);
    else this.hl.show(f.ref, f.field.label, { variant: 'warn', reduceMotion: this.reduceMotion });
    if (!res.validationError && res.ok) res.validationError = detectValidationError(f.ref, { skipEmpty: true });
    return res;
  }

  private notice(text: string) {
    const root = getShadowRoot();
    const n = document.createElement('div');
    n.setAttribute('role', 'status');
    n.style.cssText = 'position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#172033;color:#fff;font:14px system-ui,sans-serif;padding:10px 16px;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.3);pointer-events:none;max-width:80vw';
    n.textContent = text;
    root.appendChild(n);
    window.setTimeout(() => n.remove(), 4000);
  }
}
