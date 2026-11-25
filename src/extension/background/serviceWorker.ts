import { clearTab } from './tabManager';
import { registerAutoDetection, routeMessage } from './messageRouter';

// FormMate's background worker is intentionally tiny: message routing, badge, optional AI calls.
chrome.runtime.onMessage.addListener(routeMessage as Parameters<typeof chrome.runtime.onMessage.addListener>[0]);

chrome.runtime.onInstalled.addListener(async (details) => {
  try { await chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: false }); } catch { /* older browsers */ }
  try { await chrome.storage.session.setAccessLevel?.({ accessLevel: 'TRUSTED_CONTEXTS' }); } catch { /* ignore */ }
  try { await registerAutoDetection(); } catch { /* permission not granted yet: expected */ }
  if (details.reason === 'install') chrome.runtime.openOptionsPage();
});

chrome.tabs.onRemoved.addListener((tabId) => { void clearTab(tabId); });
chrome.tabs.onUpdated.addListener((tabId, info) => { if (info.status === 'loading') void clearTab(tabId); });
