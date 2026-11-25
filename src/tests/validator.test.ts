import { describe, expect, it } from 'vitest';
import { validateValue } from '@/services/form/validator';
import type { FormField } from '@/types/form';

const f = (over: Partial<FormField>): FormField => ({
  fieldId: 'x', key: 'k', label: 'F', semanticType: 'generic_text', inputType: 'text', required: false, value: '', placeholder: '',
  options: [], section: '', status: 'pending', confidence: 1, classifiedBy: 'label', sensitive: false, manualOnly: false, disabled: false, readOnly: false, ...over,
} as FormField);

describe('validateValue', () => {
  it('accepts and rejects emails', () => {
    expect(validateValue(f({ semanticType: 'email', inputType: 'email' }), 'a@b.co').ok).toBe(true);
    expect(validateValue(f({ semanticType: 'email', inputType: 'email' }), 'not-an-email').ok).toBe(false);
  });
  it('requires 10 digits for an Indian mobile number', () => {
    expect(validateValue(f({ semanticType: 'phone', inputType: 'tel' }), '9876543210').ok).toBe(true);
    expect(validateValue(f({ semanticType: 'phone', inputType: 'tel' }), '12345').ok).toBe(false);
  });
  it('rejects an option that does not exist', () => {
    const field = f({ inputType: 'select', options: [{ value: 'a', label: 'A' }] });
    expect(validateValue(field, 'a').ok).toBe(true);
    expect(validateValue(field, 'zzz').ok).toBe(false);
  });
  it('respects maxLength', () => {
    expect(validateValue(f({ maxLength: 3 }), 'abcd').ok).toBe(false);
  });
  it('rejects an empty value for a required field', () => {
    expect(validateValue(f({ required: true }), '   ').ok).toBe(false);
  });
});
