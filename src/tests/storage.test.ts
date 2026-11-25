import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryStore, loadSettings, saveSettings, setStoreForTests } from '@/services/storage/localStorageRepository';
import { clearProfile, loadProfile, profileIsEmpty, saveProfile } from '@/services/storage/profileRepository';
import { deleteAllSessions, getSession, listSessions, saveSession, sessionIdFor } from '@/services/storage/sessionRepository';
import { DEFAULT_SETTINGS } from '@/types/session';

beforeEach(() => { setStoreForTests(createMemoryStore()); });

describe('settings', () => {
  it('returns defaults and merges patches', async () => {
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
    await saveSettings({ easyMode: true, answerLang: 'ta' });
    const s = await loadSettings();
    expect(s.easyMode).toBe(true); expect(s.answerLang).toBe('ta'); expect(s.autoListen).toBe(true);
  });
});

describe('profile', () => {
  it('saves, loads and deletes', async () => {
    expect(profileIsEmpty(await loadProfile())).toBe(true);
    await saveProfile({ ...(await loadProfile()), fullName: 'Asha Kumar', email: 'asha@example.com' });
    expect((await loadProfile()).fullName).toBe('Asha Kumar');
    await clearProfile();
    expect(profileIsEmpty(await loadProfile())).toBe(true);
  });
});

describe('session history', () => {
  it('stores a summary and removes it', async () => {
    const id = sessionIdFor('https://example.com/apply?x=1');
    await saveSession({ id, host: 'example.com', title: 'Apply', url: 'https://example.com/apply', updatedAt: Date.now(), filled: 3, total: 8, status: 'in_progress' });
    expect((await getSession(id))?.filled).toBe(3);
    expect((await listSessions()).length).toBe(1);
    await deleteAllSessions();
    expect(await listSessions()).toEqual([]);
  });
  it('uses the same id for the same page', () => {
    expect(sessionIdFor('https://a.com/f?x=1')).toBe(sessionIdFor('https://a.com/f?x=1'));
  });
});
