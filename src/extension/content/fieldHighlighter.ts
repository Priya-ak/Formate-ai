import type { FieldRef } from '@/services/form/detector';
import { getShadowRoot } from './shadowHost';

const CSS = `
.ring{position:fixed;pointer-events:none;border:3px solid #5B5CE2;border-radius:8px;box-shadow:0 0 0 4px rgba(91,92,226,.25);transition:all .15s ease;box-sizing:border-box}
.ring.done{border-color:#16A34A;box-shadow:0 0 0 4px rgba(22,163,74,.25)}
.ring.warn{border-color:#F59E0B;box-shadow:0 0 0 4px rgba(245,158,11,.3)}
.tag{position:absolute;top:-26px;left:-3px;background:#5B5CE2;color:#fff;font:600 12px/1 system-ui,sans-serif;padding:5px 8px;border-radius:6px 6px 6px 0;white-space:nowrap}
.done .tag{background:#16A34A}
@media (prefers-reduced-motion: reduce){.ring{transition:none}}
`;

/** Draws a ring around the active field in FormMate's own layer; never modifies the website's elements. */
export class FieldHighlighter {
  private ring: HTMLDivElement | null = null;
  private target: HTMLElement | null = null;
  private raf = 0;
  private timer = 0;

  private ensure(): HTMLDivElement {
    const root = getShadowRoot();
    if (!root.querySelector('#fm-hl-style')) {
      const st = document.createElement('style'); st.id = 'fm-hl-style'; st.textContent = CSS; root.appendChild(st);
    }
    if (!this.ring || !this.ring.isConnected) {
      this.ring = document.createElement('div'); this.ring.className = 'ring'; this.ring.setAttribute('aria-hidden', 'true');
      root.appendChild(this.ring);
    }
    return this.ring;
  }

  private anchor(ref: FieldRef): HTMLElement {
    const el = (ref.group && ref.group[0]) || ref.el;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return (el.closest('label') as HTMLElement) || el.parentElement || el;
    return el;
  }

  show(ref: FieldRef, label: string, opts: { scroll?: boolean; reduceMotion?: boolean; variant?: 'done' | 'warn' | '' } = {}) {
    window.clearTimeout(this.timer);
    const target = this.anchor(ref);
    this.target = target;
    if (opts.scroll) {
      const r = target.getBoundingClientRect();
      const inView = r.top >= 80 && r.bottom <= window.innerHeight - 80;
      if (!inView) target.scrollIntoView({ block: 'center', behavior: opts.reduceMotion ? 'auto' : 'smooth' });
    }
    const ring = this.ensure();
    ring.className = `ring ${opts.variant || ''}`;
    ring.innerHTML = '';
    const tag = document.createElement('div'); tag.className = 'tag'; tag.textContent = label.slice(0, 40);
    ring.appendChild(tag);
    ring.style.display = 'block';
    this.loop();
  }

  private loop = () => {
    cancelAnimationFrame(this.raf);
    const tick = () => {
      if (!this.target || !this.ring || !this.target.isConnected) return;
      const r = this.target.getBoundingClientRect();
      const pad = 4;
      Object.assign(this.ring.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
      this.raf = requestAnimationFrame(tick);
    };
    tick();
  };

  /** Brief green confirmation ring after a successful fill. */
  flashDone(ref: FieldRef, label: string, reduceMotion: boolean) {
    this.show(ref, `✓ ${label}`, { variant: 'done', reduceMotion });
    this.timer = window.setTimeout(() => this.clear(), 1400);
  }

  clear() {
    cancelAnimationFrame(this.raf);
    window.clearTimeout(this.timer);
    this.target = null;
    if (this.ring) this.ring.style.display = 'none';
  }
}
