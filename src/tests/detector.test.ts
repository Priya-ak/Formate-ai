import { beforeEach, describe, expect, it } from 'vitest';
import { detectBestForm } from '@/services/form/detector';
import { loadDemo, showAllSteps } from './helpers';

describe('form detection on the demo job application', () => {
  beforeEach(() => { loadDemo(); showAllSteps(); });

  it('detects a form and classifies it as a job application', () => {
    const r = detectBestForm(document);
    expect(r).not.toBeNull();
    expect(r!.schema.kind).toBe('job');
    expect(r!.schema.fields.length).toBeGreaterThanOrEqual(5);
  });

  it('classifies core fields by label and type', () => {
    const f = detectBestForm(document)!.schema.fields;
    const byLabel = (re: RegExp) => f.find((x) => re.test(x.label));
    expect(byLabel(/full name/i)?.semanticType).toBe('full_name');
    expect(byLabel(/email/i)?.semanticType).toBe('email');
    expect(byLabel(/mobile/i)?.semanticType).toBe('phone');
    expect(byLabel(/birth/i)?.semanticType).toBe('dob');
    expect(byLabel(/full name/i)?.required).toBe(true);
  });

  it('groups radios and checkboxes into single fields with options', () => {
    const f = detectBestForm(document)!.schema.fields;
    const gender = f.find((x) => /gender/i.test(x.label));
    expect(gender?.inputType).toBe('radio');
    expect(gender?.options.length).toBe(3);
    const skills = f.find((x) => /skills/i.test(x.label));
    expect(skills?.inputType).toBe('checkbox-group');
    expect(skills?.options.map((o) => o.value)).toContain('python');
  });

  it('reads dropdown options but not the empty placeholder', () => {
    const f = detectBestForm(document)!.schema.fields;
    const edu = f.find((x) => x.inputType === 'select' && /education/i.test(x.label));
    expect(edu?.options.map((o) => o.value)).toEqual(expect.arrayContaining(['bachelors', 'masters']));
    expect(edu?.options.some((o) => o.value === '')).toBe(false);
  });

  it('marks password and file fields as not auto-fillable', () => {
    const r = detectBestForm(document, { includeLogin: true })!;
    const file = r.schema.fields.find((x) => x.inputType === 'file');
    expect(file).toBeDefined();
    const pw = r.schema.fields.find((x) => x.semanticType === 'password');
    if (pw) expect(pw.manualOnly).toBe(true);
  });

  it('detects only the visible step of a multi-step form', () => {
    loadDemo();
    const r = detectBestForm(document)!;
    expect(r.schema.fields.some((f) => /full name/i.test(f.label))).toBe(true);
    expect(r.schema.fields.some((f) => /why do you want/i.test(f.label))).toBe(false);
  });

  it('returns null on a page without a form', () => {
    document.body.innerHTML = '<p>Just an article.</p>';
    expect(detectBestForm(document)).toBeNull();
  });
});
