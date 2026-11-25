import type { FormField, SemanticType } from './form';
import type { LangCode } from './voice';

export type AIMode = 'extract' | 'polish' | 'translate' | 'explain';

export interface ExtractionRequest {
  field: Pick<FormField, 'fieldId' | 'label' | 'semanticType' | 'inputType' | 'required' | 'placeholder' | 'maxLength' | 'helpText'> & {
    options: { value: string; label: string }[];
  };
  userAnswer: string;
  answerLanguage: LangCode;
  mode: AIMode;
}

export interface ExtractionResult {
  fieldId: string;
  extractedValue: string | string[] | boolean | null;
  confidence: number;
  needsConfirmation: boolean;
  /** Short note for the user ("Translated from Tamil", "Could not find a matching option"). */
  note?: string;
  /** Which engine produced this result. */
  source: 'rules' | 'gemini';
  /** For options: the matched option value. */
  matchedOption?: string;
  clarification?: string;
}

export interface AIProvider {
  readonly id: 'rules' | 'gemini';
  readonly available: boolean;
  extract(req: ExtractionRequest): Promise<ExtractionResult>;
}

export interface AISettings {
  provider: 'none' | 'gemini';
  apiKey: string;
  model: string;
  /** User explicitly agreed that relevant answers may be sent to the AI service. */
  consent: boolean;
  /** 'preserve' keeps the user's own words; 'polish' lets AI rewrite long answers in clear English (always confirmed). */
  rewrite: 'preserve' | 'polish';
}

export interface SemanticGuess { type: SemanticType; confidence: number; by: string }
