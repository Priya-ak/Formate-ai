import type { FormField, FormSchema, SemanticType } from './form';
import type { LangCode } from './voice';
import type { AISettings } from './ai';

export interface Settings {
  assistantLang: LangCode;
  answerLang: LangCode;
  uiLang: LangCode;
  voiceName: string;
  speechRate: number;
  slowSpeech: boolean;
  speakQuestions: boolean;
  autoListen: boolean;
  autoDetect: boolean;
  floatingAssistant: boolean;
  disabledSites: string[];
  easyMode: boolean;
  highContrast: boolean;
  textSize: 'normal' | 'large' | 'xlarge';
  reducedMotion: boolean;
  confirmEveryAnswer: boolean;
  profileEnabled: boolean;
  saveHistory: boolean;
  ai: AISettings;
  onboarded: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  assistantLang: 'en',
  answerLang: 'en',
  uiLang: 'en',
  voiceName: '',
  speechRate: 1,
  slowSpeech: false,
  speakQuestions: true,
  autoListen: true,
  autoDetect: true,
  floatingAssistant: true,
  disabledSites: [],
  easyMode: false,
  highContrast: false,
  textSize: 'normal',
  reducedMotion: false,
  confirmEveryAnswer: false,
  profileEnabled: false,
  saveHistory: true,
  ai: { provider: 'none', apiKey: '', model: 'gemini-2.0-flash', consent: false, rewrite: 'preserve' },
  onboarded: false,
};

export interface UserProfile {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  education: string;
  skills: string;
  experience: string;
  languages: string;
  summary: string;
  /** Optional sensitive fields. Never auto-filled without explicit confirmation. */
  dob: string;
  gender: string;
  commonAnswers: { label: string; value: string }[];
}

export const EMPTY_PROFILE: UserProfile = {
  fullName: '', email: '', phone: '', address: '', education: '', skills: '', experience: '',
  languages: '', summary: '', dob: '', gender: '', commonAnswers: [],
};

export type ConversationPhase =
  | 'idle' | 'asking' | 'confirming' | 'profile_offer' | 'review' | 'paused' | 'done';

export interface SessionSummary {
  id: string;
  host: string;
  title: string;
  url: string;
  updatedAt: number;
  filled: number;
  total: number;
  status: 'in_progress' | 'completed' | 'paused';
  /** Present only when the user chose "Save this application for later". */
  savedAnswers?: Record<string, string | string[] | boolean>;
}

export interface ReviewSummary {
  completed: FormField[];
  missing: FormField[];
  uncertain: FormField[];
  invalid: FormField[];
  manual: FormField[];
  skipped: FormField[];
}

export interface Progress { done: number; total: number; percent: number }

export type { FormSchema, SemanticType };

// ---------- Messaging between extension parts ----------
export type ContentCommand =
  | { type: 'FM_PING' }
  | { type: 'FM_SCAN'; force?: boolean }
  | { type: 'FM_FILL'; fieldId: string; value: string | string[] | boolean }
  | { type: 'FM_HIGHLIGHT'; fieldId: string; scroll?: boolean }
  | { type: 'FM_CLEAR_HIGHLIGHT' }
  | { type: 'FM_READ_VALUES' }
  | { type: 'FM_SHOW_NOTICE'; text: string };

export type ContentEvent =
  | { type: 'FM_FORM_DETECTED'; summary: DetectionSummary }
  | { type: 'FM_SCHEMA_CHANGED'; schema: FormSchema | null; reason: 'mutation' | 'navigation' | 'step' | 'initial' }
  | { type: 'FM_FIELD_EDITED'; fieldId: string; value: string | string[] | boolean };

export interface DetectionSummary {
  hasForm: boolean;
  fieldCount: number;
  title: string;
  host: string;
  kind: FormSchema['kind'];
}

export type BackgroundRequest =
  | { type: 'FM_OPEN_SIDEPANEL'; autostart?: boolean; mode?: 'start' | 'review' }
  | { type: 'FM_GET_TAB_STATE'; tabId: number }
  | { type: 'FM_AI_EXTRACT'; request: import('./ai').ExtractionRequest }
  | { type: 'FM_ENSURE_CONTENT'; tabId: number }
  | { type: 'FM_REGISTER_AUTO' }
  | { type: 'FM_UNREGISTER_AUTO' }
  | { type: 'FM_TAKE_PENDING'; tabId: number };

export interface PendingStart { autostart: boolean; mode: 'start' | 'review'; at: number }
