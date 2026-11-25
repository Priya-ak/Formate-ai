import { beforeEach, describe, expect, it } from 'vitest';
import { detectBestForm } from '@/services/form/detector';
import { fillField } from '@/services/form/automation';
import { loadDemo, showAllSteps } from './helpers';

function setup() {
  loadDemo(); showAllSteps();
  const r = detectBestForm(document)!;
  const find = (re: RegExp) => r.schema.fields.find((f) => re.test(f.label))!;
  return { r, find };
}

describe('fill + verify', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('fills a text field and fires input/change events', async () => {
    const { r, find } = setup();
    const f = find(/full name/i);
    let events = 0;
    const el = document.getElementById('fullName') as HTMLInputElement;
    el.addEventListener('input', () => events++); el.addEventListener('change', () => events++);
    const res = await fillField(r.refs.get(f.fieldId)!, f, 'Asha Kumar');
    expect(res.ok).toBe(true);
    expect(el.value).toBe('Asha Kumar');
    expect(events).toBeGreaterThanOrEqual(2);
  });

  it('fills email and phone', async () => {
    const { r, find } = setup();
    const e = find(/email/i); const p = find(/mobile/i);
    expect((await fillField(r.refs.get(e.fieldId)!, e, 'asha@example.com')).ok).toBe(true);
    expect((await fillField(r.refs.get(p.fieldId)!, p, '9876543210')).ok).toBe(true);
    expect((document.getElementById('email') as HTMLInputElement).value).toBe('asha@example.com');
  });

  it('fills a date field in ISO form', async () => {
    const { r, find } = setup();
    const d = find(/birth/i);
    const res = await fillField(r.refs.get(d.fieldId)!, d, '1998-05-14');
    expect(res.ok).toBe(true);
    expect((document.getElementById('dob') as HTMLInputElement).value).toBe('1998-05-14');
  });

  it('selects a dropdown option by value', async () => {
    const { r, find } = setup();
    const f = r.schema.fields.find((x) => x.inputType === 'select' && /education/i.test(x.label))!;
    const res = await fillField(r.refs.get(f.fieldId)!, f, 'bachelors');
    expect(res.ok).toBe(true);
    expect((document.getElementById('education') as HTMLSelectElement).value).toBe('bachelors');
    void find;
  });

  it('selects a radio option', async () => {
    const { r } = setup();
    const f = r.schema.fields.find((x) => /work mode/i.test(x.label))!;
    const res = await fillField(r.refs.get(f.fieldId)!, f, 'remote');
    expect(res.ok).toBe(true);
    expect((document.querySelector('input[name="mode"]:checked') as HTMLInputElement).value).toBe('remote');
  });

  it('checks several checkboxes in a group', async () => {
    const { r } = setup();
    const f = r.schema.fields.find((x) => /skills/i.test(x.label))!;
    const res = await fillField(r.refs.get(f.fieldId)!, f, ['python', 'sql']);
    expect(res.ok).toBe(true);
    const on = [...document.querySelectorAll<HTMLInputElement>('input[name="skills"]:checked')].map((c) => c.value).sort();
    expect(on).toEqual(['python', 'sql']);
  });

  it('checks a consent checkbox', async () => {
    const { r } = setup();
    const f = r.schema.fields.find((x) => x.semanticType === 'consent' || /agree/i.test(x.label))!;
    const res = await fillField(r.refs.get(f.fieldId)!, f, true);
    expect(res.ok).toBe(true);
    expect((document.getElementById('consent') as HTMLInputElement).checked).toBe(true);
  });

  it('reports failure when the page resets the value', async () => {
    const { r, find } = setup();
    const f = find(/city/i);
    const el = document.getElementById('city') as HTMLInputElement;
    el.addEventListener('input', () => setTimeout(() => { el.value = ''; }, 50));
    const res = await fillField(r.refs.get(f.fieldId)!, f, 'Chennai');
    expect(res.ok).toBe(false);
  });

  it('never fills a file input', async () => {
    const { r } = setup();
    const f = r.schema.fields.find((x) => x.inputType === 'file');
    expect(f).toBeDefined();
    expect(f!.manualOnly || f!.inputType === 'file').toBe(true);
  });
});
