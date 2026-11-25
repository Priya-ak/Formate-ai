import type { Settings } from '@/types/session';

export function pageKey(): string {
  return `${location.hostname}${location.pathname}`.replace(/\/+$/, '');
}

export function isSiteDisabled(settings: Settings): boolean {
  const host = location.hostname.toLowerCase();
  return settings.disabledSites.some((s) => {
    const d = s.trim().toLowerCase();
    return !!d && (host === d || host.endsWith(`.${d}`));
  });
}

export function prefersReducedMotion(settings: Settings): boolean {
  return settings.reducedMotion || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
}

const dismissedKey = () => `fm.dismissed:${pageKey()}`;
export function wasDismissed(): boolean {
  try { return sessionStorage.getItem(dismissedKey()) === '1'; } catch { return false; }
}
export function markDismissed() {
  try { sessionStorage.setItem(dismissedKey(), '1'); } catch { /* storage may be blocked */ }
}
