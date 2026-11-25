import type { LangCode, RecognitionErrorCode, SpeechCapabilities, VoiceStatus } from '@/types/voice';
import { SpeechRecognizer } from './speechRecognition';
import { Speaker } from './speechSynthesis';

export interface VoiceEvents {
  onStatus: (s: VoiceStatus) => void;
  onInterim: (t: string) => void;
  onFinal: (t: string, confidence: number) => void;
  onError: (code: RecognitionErrorCode, message: string) => void;
}

/** Coordinates listening and speaking so the microphone never hears the assistant's own voice. */
export class VoiceManager {
  private rec = new SpeechRecognizer();
  private speaker = new Speaker();
  private status: VoiceStatus = 'idle';
  private gotFinal = false;
  constructor(private ev: VoiceEvents) {}

  capabilities(): SpeechCapabilities { return { recognition: SpeechRecognizer.isSupported(), synthesis: Speaker.isSupported() }; }
  hasVoiceFor(lang: LangCode) { return this.speaker.hasVoiceFor(lang); }
  listVoices() { return this.speaker.listVoices(); }

  private set(s: VoiceStatus) { this.status = s; this.ev.onStatus(s); }

  async speak(text: string, lang: LangCode, opts: { rate: number; voiceName?: string }): Promise<boolean> {
    this.rec.abort();
    this.set('speaking');
    const ok = await this.speaker.speak(text, lang, opts);
    if (this.status === 'speaking') this.set('idle');
    return ok;
  }

  listen(lang: LangCode): boolean {
    if (!SpeechRecognizer.isSupported()) { this.set('unsupported'); return false; }
    this.speaker.cancel();
    this.gotFinal = false;
    return this.rec.start(lang, {
      onStart: () => this.set('listening'),
      onInterim: (t) => this.ev.onInterim(t),
      onFinal: (t, c) => { this.gotFinal = true; if (t) this.ev.onFinal(t, c); },
      onError: (code, msg) => {
        this.set(code === 'not-allowed' || code === 'service-not-allowed' ? 'denied' : 'error');
        this.ev.onError(code, msg);
      },
      onEnd: () => { if (this.status === 'listening') this.set('idle'); },
    });
  }

  stopListening() { this.rec.stop(); }
  cancelAll() { this.rec.abort(); this.speaker.cancel(); this.set('idle'); }
  get current() { return this.status; }
}
