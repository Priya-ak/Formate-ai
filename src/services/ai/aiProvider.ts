import type { AIProvider, AISettings, ExtractionRequest, ExtractionResult } from '@/types/ai';
import type { FormField } from '@/types/form';

export type { AIProvider, ExtractionRequest, ExtractionResult };

/** Fields whose answers must never be sent to an external AI service. */
export const AI_BLOCKED_TYPES = new Set(['password', 'otp', 'payment', 'captcha', 'id_number']);

export function canUseAI(s: AISettings, field: Pick<FormField, 'semanticType' | 'sensitive' | 'manualOnly'>): boolean {
  return s.provider === 'gemini' && !!s.apiKey && s.consent && !field.sensitive && !field.manualOnly && !AI_BLOCKED_TYPES.has(field.semanticType);
}

/** Validates (never trusts) JSON coming back from an LLM. Returns null when unusable. */
export function validateAIResult(raw: unknown, req: ExtractionRequest): ExtractionResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const conf = typeof r.confidence === 'number' ? Math.min(1, Math.max(0, r.confidence)) : 0;
  const clarification = typeof r.clarification === 'string' ? r.clarification.slice(0, 200) : undefined;
  const note = typeof r.note === 'string' ? r.note.slice(0, 200) : undefined;
  let value: ExtractionResult['extractedValue'] = null;
  const ev = r.extractedValue;
  if (typeof ev === 'string' && ev.trim()) value = ev.trim();
  else if (typeof ev === 'boolean') value = ev;
  else if (Array.isArray(ev) && ev.every((x) => typeof x === 'string')) value = ev as string[];
  if (value === null) return { fieldId: req.field.fieldId, extractedValue: null, confidence: 0, needsConfirmation: false, source: 'gemini', clarification: clarification || 'unclear', note };

  const opts = req.field.options;
  if (req.mode === 'extract' && opts.length && (req.field.inputType === 'select' || req.field.inputType === 'radio')) {
    const hit = opts.find((o) => o.value === value || o.label === value);
    if (!hit) return { fieldId: req.field.fieldId, extractedValue: null, confidence: 0, needsConfirmation: false, source: 'gemini', clarification: 'no_option' };
    value = hit.value;
  }
  if (req.field.inputType === 'checkbox') {
    if (typeof value === 'string') value = /^(true|yes)$/i.test(value);
  }
  if (typeof value === 'string' && req.field.maxLength && value.length > req.field.maxLength) value = value.slice(0, req.field.maxLength);
  if (typeof value === 'string' && value.length > 4000) value = value.slice(0, 4000);
  return {
    fieldId: req.field.fieldId,
    extractedValue: value,
    confidence: conf,
    // anything the AI rewrote or translated is always confirmed by the user
    needsConfirmation: req.mode !== 'extract' || r.needsConfirmation === true || conf < 0.75,
    note, clarification, source: 'gemini',
    matchedOption: typeof r.matchedOption === 'string' ? r.matchedOption : undefined,
  };
}
