import { describe, expect, it } from 'vitest';
import { canUseAI, validateAIResult } from '@/services/ai/aiProvider';
import type { ExtractionRequest } from '@/types/ai';
import { DEFAULT_SETTINGS } from '@/types/session';

const on = { ...DEFAULT_SETTINGS.ai, provider: 'gemini' as const, apiKey: 'k', consent: true };
const req: ExtractionRequest = {
  field: { fieldId: 'f', label: 'Role', semanticType: 'job_role', inputType: 'select', required: true, placeholder: '', helpText: '', options: [{ value: 'dev', label: 'Developer' }] },
  userAnswer: 'developer', answerLanguage: 'en', mode: 'extract',
};

describe('AI gating', () => {
  it('is off by default, without a key, or without consent', () => {
    const f = { semanticType: 'job_role' as const, sensitive: false, manualOnly: false };
    expect(canUseAI(DEFAULT_SETTINGS.ai, f)).toBe(false);
    expect(canUseAI({ ...on, apiKey: '' }, f)).toBe(false);
    expect(canUseAI({ ...on, consent: false }, f)).toBe(false);
    expect(canUseAI(on, f)).toBe(true);
  });
  it('is never used for sensitive or manual-only fields', () => {
    expect(canUseAI(on, { semanticType: 'password', sensitive: false, manualOnly: true })).toBe(false);
    expect(canUseAI(on, { semanticType: 'id_number', sensitive: true, manualOnly: false })).toBe(false);
    expect(canUseAI(on, { semanticType: 'payment', sensitive: false, manualOnly: false })).toBe(false);
  });
});

describe('AI output validation', () => {
  it('accepts a valid option match', () => {
    const r = validateAIResult({ extractedValue: 'dev', confidence: 0.9, needsConfirmation: false }, req);
    expect(r?.extractedValue).toBe('dev');
  });
  it('rejects an option that is not on the page', () => {
    const r = validateAIResult({ extractedValue: 'wizard', confidence: 0.9, needsConfirmation: false }, req);
    expect(r === null || r.extractedValue === null).toBe(true);
  });
  it('rejects garbage', () => {
    expect(validateAIResult('hello', req)).toBeNull();
    expect(validateAIResult(null, req)).toBeNull();
  });
});
