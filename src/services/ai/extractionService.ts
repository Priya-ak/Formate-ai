import type { AIProvider, AISettings, ExtractionRequest, ExtractionResult } from '@/types/ai';
import type { FormField } from '@/types/form';
import type { LangCode } from '@/types/voice';
import { canUseAI } from './aiProvider';
import { RuleBasedProvider } from './ruleBasedProvider';
import { isLatin } from '@/utils/text';

/** Sends the request to the background worker, where the optional Gemini key lives. */
export class RemoteAIProvider implements AIProvider {
  readonly id = 'gemini' as const;
  readonly available = true;
  async extract(req: ExtractionRequest): Promise<ExtractionResult> {
    const res = await chrome.runtime.sendMessage({ type: 'FM_AI_EXTRACT', request: req });
    if (!res || res.error) throw new Error(res?.error || 'AI is not available.');
    return res.result as ExtractionResult;
  }
}

export interface ExtractionOutcome extends ExtractionResult { aiError?: string }

const rules = new RuleBasedProvider();

function toRequest(field: FormField, text: string, lang: LangCode, mode: ExtractionRequest['mode']): ExtractionRequest {
  return {
    field: {
      fieldId: field.fieldId, label: field.label, semanticType: field.semanticType, inputType: field.inputType, required: field.required,
      placeholder: field.placeholder, maxLength: field.maxLength, helpText: field.helpText,
      options: field.options.map((o) => ({ value: o.value, label: o.label })),
    },
    userAnswer: text, answerLanguage: lang, mode,
  };
}

/**
 * Rule-based first. The optional AI is used only when (a) the user enabled polishing for long answers,
 * (b) the rules could not understand the answer, or (c) the answer is non-English and the field is free text.
 * If the AI fails the built-in result is used and the failure is reported, never hidden.
 */
export async function extractSmart(
  field: FormField, text: string, lang: LangCode, ai: AISettings, remote: AIProvider | null,
): Promise<ExtractionOutcome> {
  const base = await rules.extract(toRequest(field, text, lang, 'extract'));
  if (!remote || !canUseAI(ai, field)) return base;

  const longText = field.inputType === 'textarea' || ['experience', 'why_apply', 'summary', 'skills', 'education'].includes(field.semanticType);
  const wantPolish = ai.rewrite === 'polish' && longText;
  const rulesFailed = base.extractedValue === null || base.confidence < 0.6;
  const needsTranslate = !isLatin(text) && ['text', 'textarea'].includes(field.inputType) && !['email', 'phone', 'postal_code'].includes(field.semanticType);

  if (!(wantPolish || rulesFailed || needsTranslate)) return base;
  const mode: ExtractionRequest['mode'] = wantPolish ? (isLatin(text) ? 'polish' : 'translate') : needsTranslate ? 'translate' : 'extract';
  try {
    const r = await remote.extract(toRequest(field, text, lang, mode));
    if (r.extractedValue === null && base.extractedValue !== null) return base;
    return r;
  } catch (e) {
    return { ...base, aiError: e instanceof Error ? e.message : 'AI unavailable' };
  }
}

export async function explainField(field: FormField, lang: LangCode, ai: AISettings, remote: AIProvider | null): Promise<string | null> {
  if (!remote || !canUseAI(ai, field)) return null;
  try {
    const r = await remote.extract(toRequest(field, field.label, lang, 'explain'));
    return typeof r.extractedValue === 'string' ? r.extractedValue : null;
  } catch { return null; }
}
