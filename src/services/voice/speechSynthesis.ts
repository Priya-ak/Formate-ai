import type { LangCode } from '@/types/voice';
import { bcp47 } from './speechRecognition';

function synth(): SpeechSynthesis | null {
  return typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
}

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  const s = synth();
  if (!s) return Promise.resolve([]);
  const v = s.getVoices();
  if (v.length) return Promise.resolve(v);
  return new Promise((resolve) => {
    const done = () => resolve(s.getVoices());
    s.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, 1200);
  });
}

export class Speaker {
  private voices: SpeechSynthesisVoice[] = [];
  private ready: Promise<void>;

  constructor() { this.ready = loadVoices().then((v) => { this.voices = v; }); }

  static isSupported(): boolean { return !!synth(); }

  async listVoices(): Promise<SpeechSynthesisVoice[]> { await this.ready; return this.voices; }

  /** Is there an installed voice for this language? We never pretend to speak without one. */
  async hasVoiceFor(lang: LangCode): Promise<boolean> {
    await this.ready;
    const base = bcp47(lang).slice(0, 2).toLowerCase();
    return this.voices.some((v) => v.lang.toLowerCase().startsWith(base));
  }

  private pick(lang: LangCode, preferred?: string): SpeechSynthesisVoice | null {
    const base = bcp47(lang).slice(0, 2).toLowerCase();
    const exact = bcp47(lang).toLowerCase();
    const pool = this.voices.filter((v) => v.lang.toLowerCase().startsWith(base));
    if (!pool.length) return null;
    return pool.find((v) => preferred && v.name === preferred) || pool.find((v) => v.lang.toLowerCase() === exact) || pool[0];
  }

  /** Resolves true when speech finished, false when there was no voice or it was cancelled. */
  async speak(text: string, lang: LangCode, opts: { rate?: number; voiceName?: string } = {}): Promise<boolean> {
    const s = synth();
    if (!s || !text.trim()) return false;
    await this.ready;
    const voice = this.pick(lang, opts.voiceName);
    if (!voice) return false;
    this.cancel();
    return new Promise<boolean>((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = opts.rate ?? 1;
      let settled = false;
      const finish = (ok: boolean) => { if (!settled) { settled = true; clearInterval(poll); resolve(ok); } };
      u.onend = () => finish(true);
      u.onerror = () => finish(false);
      // Chrome occasionally never fires onend for long utterances: poll as a safety net.
      const started = Date.now();
      const poll = setInterval(() => { if (!s.speaking && Date.now() - started > 600) finish(true); }, 400);
      s.speak(u);
    });
  }

  cancel() { try { synth()?.cancel(); } catch { /* ignore */ } }
}
