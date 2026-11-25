import { getShadowRoot } from './shadowHost';
import type { LangCode } from '@/types/voice';
import { t } from '@/services/i18n';

const MIC = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/></svg>';

const CSS = `
:host{all:initial}
*{box-sizing:border-box;font-family:Inter,'Segoe UI','Noto Sans Tamil','Noto Sans Devanagari',system-ui,sans-serif}
.fab{position:fixed;width:56px;height:56px;border-radius:50%;border:0;cursor:pointer;pointer-events:auto;background:linear-gradient(135deg,#5B5CE2,#8B5CF6);box-shadow:0 8px 24px rgba(91,92,226,.45);display:flex;align-items:center;justify-content:center;touch-action:none;transition:transform .15s}
.fab:hover{transform:scale(1.06)}
.fab:focus-visible{outline:3px solid #172033;outline-offset:3px}
.badge{position:absolute;top:-4px;right:-4px;min-width:20px;height:20px;border-radius:10px;background:#16A34A;color:#fff;font:700 11px/20px system-ui;text-align:center;padding:0 5px;border:2px solid #fff}
.card{position:fixed;width:min(330px,92vw);background:#fff;color:#172033;border-radius:16px;box-shadow:0 12px 40px rgba(23,32,51,.28);padding:16px;pointer-events:auto;border:1px solid #E2E8F0}
.card h2{margin:0 0 6px;font-size:15px;font-weight:700;display:flex;align-items:center;gap:8px}
.card p{margin:0 0 12px;font-size:14px;line-height:1.45}
.row{display:flex;flex-wrap:wrap;gap:8px}
button.b{font:600 13px system-ui;border-radius:10px;padding:9px 12px;cursor:pointer;border:1px solid #CBD5E1;background:#fff;color:#172033}
button.b.primary{background:#5B5CE2;border-color:#5B5CE2;color:#fff}
button.b:focus-visible{outline:3px solid #172033;outline-offset:2px}
.dot{width:10px;height:10px;border-radius:50%;background:#5B5CE2;display:inline-block}
.err{color:#DC2626;font-size:13px;margin-top:8px}
.hide{display:none}
@media (prefers-reduced-motion: reduce){.fab{transition:none}}
`;

export interface FabOptions {
  getLang: () => LangCode;
  onStart: () => Promise<{ ok: boolean; error?: string }>;
  onReview: () => Promise<{ ok: boolean; error?: string }>;
  onOpen: () => Promise<{ ok: boolean; error?: string }>;
  onDismiss: () => void;
}

export class FloatingAssistant {
  private wrap!: HTMLDivElement;
  private fab!: HTMLButtonElement;
  private card!: HTMLDivElement;
  private badge!: HTMLSpanElement;
  private fieldCount = 0;
  private pos = { right: 20, bottom: 20 };
  private mounted = false;

  constructor(private o: FabOptions) {}

  async mount() {
    if (this.mounted) return;
    const root = getShadowRoot();
    const style = document.createElement('style'); style.textContent = CSS; root.appendChild(style);
    this.wrap = document.createElement('div');
    this.fab = document.createElement('button');
    this.fab.className = 'fab'; this.fab.type = 'button'; this.fab.setAttribute('aria-label', 'FormMate voice form assistant');
    this.fab.innerHTML = MIC;
    this.badge = document.createElement('span'); this.badge.className = 'badge hide'; this.fab.appendChild(this.badge);
    this.card = document.createElement('div'); this.card.className = 'card hide'; this.card.setAttribute('role', 'dialog'); this.card.setAttribute('aria-label', 'FormMate');
    this.wrap.append(this.fab, this.card);
    root.appendChild(this.wrap);
    try {
      const saved = await chrome.storage.local.get('fm.fabPos');
      if (saved['fm.fabPos']) this.pos = saved['fm.fabPos'];
    } catch { /* default position */ }
    this.place();
    this.bindDrag();
    this.fab.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.hideCard(); });
    window.addEventListener('resize', () => this.place());
    this.mounted = true;
  }

  private place() {
    const maxR = Math.max(8, window.innerWidth - 72), maxB = Math.max(8, window.innerHeight - 72);
    this.pos.right = Math.min(Math.max(8, this.pos.right), maxR);
    this.pos.bottom = Math.min(Math.max(8, this.pos.bottom), maxB);
    this.fab.style.right = `${this.pos.right}px`;
    this.fab.style.bottom = `${this.pos.bottom}px`;
    this.card.style.right = `${this.pos.right}px`;
    this.card.style.bottom = `${this.pos.bottom + 66}px`;
  }

  private bindDrag() {
    let startX = 0, startY = 0, startR = 0, startB = 0, moved = false, down = false;
    this.fab.addEventListener('pointerdown', (e) => {
      down = true; moved = false; startX = e.clientX; startY = e.clientY; startR = this.pos.right; startB = this.pos.bottom;
      this.fab.setPointerCapture(e.pointerId);
    });
    this.fab.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
      if (moved) { this.pos = { right: startR - dx, bottom: startB - dy }; this.place(); }
    });
    this.fab.addEventListener('pointerup', (e) => {
      down = false;
      try { this.fab.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      if (moved) { try { void chrome.storage.local.set({ 'fm.fabPos': this.pos }); } catch { /* ignore */ } }
      else this.toggleCard();
    });
  }

  setFieldCount(n: number) {
    this.fieldCount = n;
    if (!this.mounted) return;
    this.badge.textContent = String(n);
    this.badge.classList.toggle('hide', n === 0);
  }

  private toggleCard() { this.card.classList.contains('hide') ? this.showCard() : this.hideCard(); }
  hideCard() { if (this.mounted) this.card.classList.add('hide'); }

  showCard() {
    const lang = this.o.getLang();
    this.card.classList.remove('hide');
    this.card.textContent = '';
    const h = document.createElement('h2'); h.innerHTML = '<span class="dot"></span>FormMate';
    const p = document.createElement('p');
    const row = document.createElement('div'); row.className = 'row';
    const err = document.createElement('div'); err.className = 'err hide'; err.setAttribute('role', 'alert');
    const btn = (label: string, cls: string, fn: () => Promise<{ ok: boolean; error?: string }> | void) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = `b ${cls}`; b.textContent = label;
      b.addEventListener('click', async () => {
        const r = await fn();
        if (r && !r.ok) { err.textContent = r.error || 'Click the FormMate icon in the browser toolbar to open the side panel.'; err.classList.remove('hide'); }
        else if (r?.ok) this.hideCard();
      });
      return b;
    };
    if (this.fieldCount > 0) {
      p.textContent = t(lang, 'ui.hello', { n: this.fieldCount });
      row.append(
        btn(t(lang, 'ui.start'), 'primary', () => this.o.onStart()),
        btn(t(lang, 'ui.notNow'), '', () => { this.o.onDismiss(); this.hideCard(); }),
        btn(t(lang, 'ui.reviewFields'), '', () => this.o.onReview()),
      );
    } else {
      p.textContent = t(lang, 'ui.noForm');
      row.append(btn(t(lang, 'ui.openPanel'), 'primary', () => this.o.onOpen()));
    }
    this.card.append(h, p, row, err);
    (row.querySelector('button') as HTMLButtonElement | null)?.focus();
  }

  setVisible(v: boolean) {
    if (!this.mounted) return;
    this.wrap.style.display = v ? '' : 'none';
    if (!v) this.hideCard();
  }
}
