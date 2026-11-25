import { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, type Settings } from '@/types/session';
import { loadSettings, onSettingsChanged, saveSettings } from '@/services/storage/localStorageRepository';

/** Loads settings from chrome.storage.local, stays in sync across extension pages, applies accessibility classes. */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    loadSettings().then((s) => { if (alive) { setSettings(s); setReady(true); } });
    const off = onSettingsChanged((s) => alive && setSettings(s));
    return () => { alive = false; off(); };
  }, []);

  useEffect(() => {
    const c = document.documentElement.classList;
    c.toggle('fm-large', settings.textSize === 'large' || settings.easyMode);
    c.toggle('fm-xlarge', settings.textSize === 'xlarge');
    c.toggle('fm-contrast', settings.highContrast);
    c.toggle('fm-reduce', settings.reducedMotion);
  }, [settings.textSize, settings.highContrast, settings.reducedMotion, settings.easyMode]);

  const update = async (patch: Partial<Settings>) => {
    const next = await saveSettings(patch);
    setSettings(next);
  };
  return { settings, update, ready };
}
