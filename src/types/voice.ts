export type LangCode = 'en' | 'ta' | 'hi' | 'te' | 'kn' | 'ml' | 'bn' | 'mr';

export interface LangInfo { code: LangCode; label: string; native: string; bcp47: string }

export const LANGUAGES: LangInfo[] = [
  { code: 'en', label: 'English', native: 'English', bcp47: 'en-IN' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்', bcp47: 'ta-IN' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी', bcp47: 'hi-IN' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు', bcp47: 'te-IN' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ', bcp47: 'kn-IN' },
  { code: 'ml', label: 'Malayalam', native: 'മലയാളം', bcp47: 'ml-IN' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা', bcp47: 'bn-IN' },
  { code: 'mr', label: 'Marathi', native: 'मराठी', bcp47: 'mr-IN' },
];

export type VoiceStatus = 'idle' | 'listening' | 'speaking' | 'unsupported' | 'denied' | 'error';

export interface SpeechCapabilities {
  recognition: boolean;
  synthesis: boolean;
}

export type RecognitionErrorCode =
  | 'not-allowed' | 'service-not-allowed' | 'no-speech' | 'audio-capture' | 'network'
  | 'language-not-supported' | 'aborted' | 'unknown';

export interface RecognitionHandlers {
  onInterim?: (text: string) => void;
  onFinal: (text: string, confidence: number) => void;
  onError?: (code: RecognitionErrorCode, message: string) => void;
  onEnd?: () => void;
  onStart?: () => void;
}
