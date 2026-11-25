import { describe, expect, it, vi } from 'vitest';
import { ConversationEngine, type EngineHost } from '@/services/ai/conversationEngine';
import { extractAnswer } from '@/services/ai/answerExtractor';
import { detectBestForm } from '@/services/form/detector';
import { fillField } from '@/services/form/automation';
import { loadDemo, showAllSteps } from './helpers';

function makeEngine(opts: Partial<ConstructorParameters<typeof ConversationEngine>[1]> = {}) {
  loadDemo(); showAllSteps();
  const det = detectBestForm(document)!;
  const fills: string[] = [];
  const host: EngineHost = {
    fill: vi.fn(async (id, value) => {
      const field = det.schema.fields.find((f) => f.fieldId === id)!;
      fills.push(field.label);
      return fillField(det.refs.get(id)!, field, value);
    }),
    highlight: vi.fn(), clearHighlight: vi.fn(),
    extract: async (field, text) => extractAnswer(field, text),
  };
  const engine = new ConversationEngine(host, { assistantLang: 'en', confirmEveryAnswer: false, profile: null, profileEnabled: false, aiAvailable: false, ...opts });
  engine.load(det.schema);
  return { engine, host, det, fills };
}

describe('conversation engine', () => {
  it('starts by asking the first fillable question', () => {
    const { engine } = makeEngine();
    engine.start();
    const s = engine.getState();
    expect(s.phase).toBe('asking');
    expect(s.current).not.toBeNull();
    expect(s.message.length).toBeGreaterThan(3);
  });

  it('fills the page field after an answer and advances', async () => {
    const { engine } = makeEngine();
    engine.start();
    const first = engine.getState().current!;
    expect(first.semanticType).toBe('full_name');
    await engine.submitAnswer('my name is Asha Kumar');
    expect((document.getElementById('fullName') as HTMLInputElement).value).toBe('Asha Kumar');
    expect(engine.getState().current?.fieldId).not.toBe(first.fieldId);
    expect(engine.getState().progress.done).toBe(1);
  });

  it('asks again (and fills nothing) when the answer is unusable', async () => {
    const { engine, host } = makeEngine();
    engine.start();
    await engine.submitAnswer('my name is Asha');   // name
    await engine.submitAnswer('I do not know');      // email: unusable
    expect(host.fill).toHaveBeenCalledTimes(1);
    expect(engine.getState().current?.semanticType).toBe('email');
    expect((document.getElementById('email') as HTMLInputElement).value).toBe('');
  });

  it('asks for confirmation when confirmEveryAnswer is on', async () => {
    const { engine, host } = makeEngine({ confirmEveryAnswer: true });
    engine.start();
    await engine.submitAnswer('Asha Kumar');
    expect(engine.getState().phase).toBe('confirming');
    expect(host.fill).not.toHaveBeenCalled();
    await engine.confirm(true);
    expect(host.fill).toHaveBeenCalledTimes(1);
    expect((document.getElementById('fullName') as HTMLInputElement).value).toBe('Asha Kumar');
  });

  it('skip leaves the field empty and reports it as skipped in review', async () => {
    const { engine } = makeEngine();
    engine.start();
    engine.skip();
    engine.goReview();
    const r = engine.getState().review!;
    expect(r.skipped.length + r.missing.length).toBeGreaterThan(0);
    expect((document.getElementById('fullName') as HTMLInputElement).value).toBe('');
  });

  it('pauses and resumes', () => {
    const { engine } = makeEngine();
    engine.start(); engine.pause();
    expect(engine.getState().phase).toBe('paused');
    engine.resume();
    expect(engine.getState().phase).toBe('asking');
  });

  it('never asks the user to speak a password or file; those are manual notices only', async () => {
    const { engine, host } = makeEngine();
    engine.start();
    for (let i = 0; i < 60 && engine.getState().phase === 'asking'; i++) {
      const st = engine.getState(); const c = st.current; if (!c) break;
      if (c.manualOnly || c.inputType === 'file') {
        expect(st.isNotice).toBe(true);
        await engine.submitAnswer('secret123');
        expect(host.fill).not.toHaveBeenCalledWith(c.fieldId, expect.anything());
      } else engine.skip();
    }
    expect((document.getElementById('pw') as HTMLInputElement).value).toBe('');
  });

  it('never submits the form', async () => {
    const { engine } = makeEngine();
    const form = document.getElementById('apply') as HTMLFormElement;
    let submitted = false; form.addEventListener('submit', () => { submitted = true; });
    engine.start();
    await engine.submitAnswer('Asha Kumar');
    engine.goReview();
    expect(submitted).toBe(false);
  });

  it('speaks in the chosen assistant language', () => {
    const { engine } = makeEngine({ assistantLang: 'ta' });
    engine.start();
    expect(engine.getState().messageLang).toBe('ta');
  });

  it('offers profile values only after the user agrees', async () => {
    const { engine, host } = makeEngine({
      profileEnabled: true,
      profile: { fullName: 'Asha Kumar', email: 'asha@example.com', phone: '', address: '', education: '', skills: '', experience: '', languages: '', summary: '', dob: '', gender: '', commonAnswers: [] },
    });
    engine.start();
    expect(engine.getState().phase).toBe('profile_offer');
    expect(host.fill).not.toHaveBeenCalled();
    await engine.submitAnswer('yes');
    expect((document.getElementById('fullName') as HTMLInputElement).value).toBe('Asha Kumar');
  });
});
