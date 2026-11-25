import { EMPTY_PROFILE, type UserProfile } from '@/types/session';
import { getStore } from './localStorageRepository';

const KEY = 'fm.profile';

export async function loadProfile(): Promise<UserProfile> {
  const p = await getStore().get<Partial<UserProfile>>(KEY);
  return { ...EMPTY_PROFILE, ...(p || {}), commonAnswers: p?.commonAnswers ?? [] };
}

export async function saveProfile(p: UserProfile): Promise<void> {
  await getStore().set(KEY, p);
}

export async function clearProfile(): Promise<void> {
  await getStore().remove(KEY);
}

export function profileIsEmpty(p: UserProfile): boolean {
  return Object.entries(p).every(([k, v]) => (k === 'commonAnswers' ? (v as unknown[]).length === 0 : !String(v).trim()));
}
