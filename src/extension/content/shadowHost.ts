import { FM_ROOT_ID } from '@/services/form/domUtils';

let root: ShadowRoot | null = null;

/** One shadow-DOM host for all FormMate UI injected into pages, so page CSS cannot break it and ours cannot leak. */
export function getShadowRoot(): ShadowRoot {
  if (root && root.host.isConnected) return root;
  let host = document.getElementById(FM_ROOT_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = FM_ROOT_ID;
    host.setAttribute('data-formmate', 'true');
    host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483646;pointer-events:none;';
    (document.body || document.documentElement).appendChild(host);
  }
  root = host.shadowRoot || host.attachShadow({ mode: 'open' });
  return root;
}

export function destroyShadowRoot() {
  document.getElementById(FM_ROOT_ID)?.remove();
  root = null;
}
