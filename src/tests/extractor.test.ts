import { describe, expect, it } from 'vitest';
import { bestOption, detectIntent, extractAnswer, extractEmail, extractNumber, extractPhone, isNo, isYes, parseSpokenDate, spokenToDigits } from '@/services/ai/answerExtractor';
import type { FormField } from '@/types/form';

const field = (over: Partial<FormField>): FormField => ({
  fieldId: 'f1', key: 'k', label: 'Field', semanticType: 'generic_text', inputType: 'text', required: false, value: '', placeholder: '',
  options: [], section: '', status: 'pending', confidence: 1, classifiedBy: 'label', sensitive: false, manualOnly: false, disabled: false, readOnly: false,
  ...over,
} as FormField);

describe('spoken email', () => {
  it('turns "at" and "dot" into symbols', () => {
    expect(extractEmail('asha dot kumar at gmail dot com')).toBe('asha.kumar@gmail.com');
  });
  it('keeps a typed email', () => { expect(extractEmail('it is asha@example.com')).toBe('asha@example.com'); });
  it('returns null when there is no email', () => { expect(extractEmail('hello there')).toBeNull(); });
});

describe('spoken numbers and phones', () => {
  it('converts English number words to digits', () => { expect(spokenToDigits('nine eight seven six five four three two one zero')).toBe('9876543210'); });
  it('converts Tamil/Hindi digit words or numerals', () => { expect(spokenToDigits('९८७६५४३२१०')).toBe('9876543210'); });
  it('extracts a phone number', () => { expect(extractPhone('my number is 98765 43210')).toBe('9876543210'); });
  it('extracts a number', () => { expect(extractNumber('about five years')).toBe(5); });
});

describe('dates', () => {
  it('parses "14 May 1998"', () => { expect(parseSpokenDate('14 May 1998')).toBe('1998-05-14'); });
  it('parses numeric dd/mm/yyyy', () => { expect(parseSpokenDate('14/05/1998')).toBe('1998-05-14'); });
  it('returns null for nonsense', () => { expect(parseSpokenDate('banana')).toBeNull(); });
});

describe('yes / no / intents', () => {
  it('recognises yes and no in several languages', () => {
    expect(isYes('yes')).toBe(true); expect(isYes('ஆமாம்')).toBe(true); expect(isYes('हाँ')).toBe(true);
    expect(isNo('no')).toBe(true); expect(isNo('இல்லை')).toBe(true); expect(isNo('नहीं')).toBe(true);
  });
  it('detects voice commands', () => {
    expect(detectIntent('skip')?.type).toBe('skip');
    expect(detectIntent('repeat')?.type).toBe('repeat');
    expect(detectIntent('go back')?.type).toBe('back');
    expect(detectIntent('pause')?.type).toBe('pause');
  });
});

describe('option matching', () => {
  const opts = [{ value: 'bachelors', label: "Bachelor's degree" }, { value: 'masters', label: "Master's degree" }, { value: 'diploma', label: 'Diploma' }];
  it('matches by words', () => { expect(bestOption('I have a masters', opts).match?.option.value).toBe('masters'); });
  it('does not guess when nothing matches', () => { expect(bestOption('astronaut', opts).match).toBeUndefined(); });
});

describe('extractAnswer', () => {
  it('extracts an email field', () => {
    const r = extractAnswer(field({ semanticType: 'email', inputType: 'email' }), 'asha at example dot com');
    expect(r.extractedValue).toBe('asha@example.com');
  });
  it('extracts a name without filler words', () => {
    const r = extractAnswer(field({ semanticType: 'full_name' }), 'my name is Asha Kumar');
    expect(String(r.extractedValue)).toBe('Asha Kumar');
  });
  it('picks a dropdown option', () => {
    const r = extractAnswer(field({ inputType: 'select', options: [{ value: 'remote', label: 'Remote' }, { value: 'onsite', label: 'On-site' }] }), 'remote please');
    expect(r.extractedValue).toBe('remote');
  });
  it('maps yes to a checkbox', () => {
    const r = extractAnswer(field({ inputType: 'checkbox', semanticType: 'consent' }), 'yes');
    expect(r.extractedValue).toBe(true);
  });
  it('returns null when the answer is unusable', () => {
    const r = extractAnswer(field({ semanticType: 'email', inputType: 'email' }), 'umm I do not know');
    expect(r.extractedValue).toBeNull();
  });
});
