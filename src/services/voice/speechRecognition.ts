import type { LangCode, RecognitionErrorCode, RecognitionHandlers } from '@/types/voice';
import { LANGUAGES } from '@/types/voice';

type SR = {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: any) => void) | null; onerror: ((e: any) => void) | null; onend: (() => void) | null; onstart: (() => void) | null;
};

function ctor(): (new () => SR) | null {
  const w = globalThis as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export const bcp47 = (lang: LangCode) => LANGUAGES.find((l) => l.code === lang)?.bcp47 ?? 'en-IN';

/** Thin wrapper over the browser SpeechRecognition API. Reports real results and real errors only. */
export class SpeechRecognizer {
  private rec: SR | null = null;
  private active = false;
  private gotResult = false;

  static isSupported(): boolean { return !!ctor(); }

  get listening() { return this.active; }

  start(lang: LangCode, h: RecognitionHandlers): boolean {
    const C = ctor();
    if (!C) { h.onError?.('language-not-supported', 'Speech recognition is not supported in this browser.'); return false; }
    this.abort();
    const rec = new C();
    rec.lang = bcp47(lang);
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    this.gotResult = false;
    rec.onstart = () => { this.active = true; h.onStart?.(); };
    rec.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const alt = r[0];
        if (r.isFinal) { this.gotResult = true; h.onFinal(String(alt.transcript).trim(), typeof alt.confidence === 'number' ? alt.confidence : 0); }
        else interim += alt.transcript;
      }
      if (interim) h.onInterim?.(interim.trim());
    };
    rec.onerror = (e: any) => {
      const code = (['not-allowed', 'service-not-allowed', 'no-speech', 'audio-capture', 'network', 'language-not-supported', 'aborted'].includes(e.error) ? e.error : 'unknown') as RecognitionErrorCode;
      h.onError?.(code, String(e.message || e.error || ''));
    };
    rec.onend = () => { this.active = false; this.rec = null; h.onEnd?.(); };
    this.rec = rec;
    try { rec.start(); return true; } catch (err) {
      this.active = false; this.rec = null;
      h.onError?.('unknown', err instanceof Error ? err.message : 'Could not start the microphone.');
      return false;
    }
  }

  stop() { try { this.rec?.stop(); } catch { /* ignore */ } }
  abort() {
    const r = this.rec;
    this.rec = null; this.active = false;
    if (r) { r.onend = null; r.onerror = null; r.onresult = null; try { r.abort(); } catch { /* ignore */ } }
  }
}
