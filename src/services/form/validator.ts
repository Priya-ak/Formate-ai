import type { FormField } from '@/types/form';
import { extractPhone } from '@/services/ai/answerExtractor';

export interface Validation { ok: boolean; reasonKey?: string; }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Validates a value against what we know about the field (type, constraints, options). Mirrors, never bypasses, site validation. */
export function validateValue(field: FormField, value: string | string[] | boolean): Validation {
  if (typeof value === 'boolean') {
    if (!value && field.required && (field.inputType === 'checkbox') && field.legal) return { ok: false, reasonKey: 'reason.required' };
    return { ok: true };
  }
  const arr = Array.isArray(value);
  const s = arr ? (value as string[]).join(',') : String(value);
  if (!s.trim()) return field.required ? { ok: false, reasonKey: 'reason.required' } : { ok: true };

  if (field.inputType === 'select' || field.inputType === 'radio') {
    if (field.options.length && !field.options.some((o) => o.value === s || o.label === s)) return { ok: false, reasonKey: 'reason.option' };
    return { ok: true };
  }
  if (arr) return { ok: true };

  if (field.inputType === 'email' || field.semanticType === 'email') {
    if (!EMAIL_RE.test(s)) return { ok: false, reasonKey: 'reason.email' };
  }
  if (field.inputType === 'tel' || field.semanticType === 'phone') {
    const d = s.replace(/\D/g, '');
    const normalized = extractPhone(d) ?? d;
    if (normalized.length < 7 || normalized.length > 15) return { ok: false, reasonKey: 'reason.phone' };
  }
  if (field.semanticType === 'postal_code') {
    const d = s.replace(/\D/g, '');
    if (d.length < 4 || d.length > 10) return { ok: false, reasonKey: 'reason.postal' };
  }
  if (field.inputType === 'number' || field.semanticType === 'years_experience' || field.semanticType === 'generic_number') {
    const n = Number(s);
    if (Number.isNaN(n)) return { ok: false, reasonKey: 'reason.number' };
    if (field.min !== undefined && field.min !== '' && n < Number(field.min)) return { ok: false, reasonKey: 'reason.range' };
    if (field.max !== undefined && field.max !== '' && n > Number(field.max)) return { ok: false, reasonKey: 'reason.range' };
  }
  if (field.inputType === 'date') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) return { ok: false, reasonKey: 'reason.date' };
    if (field.min && s < field.min) return { ok: false, reasonKey: 'reason.range' };
    if (field.max && s > field.max) return { ok: false, reasonKey: 'reason.range' };
    if (field.semanticType === 'dob' && s > new Date().toISOString().slice(0, 10)) return { ok: false, reasonKey: 'reason.date' };
  }
  if (field.minLength && s.length < field.minLength) return { ok: false, reasonKey: 'reason.length' };
  if (field.maxLength && s.length > field.maxLength) return { ok: false, reasonKey: 'reason.length' };
  if (field.pattern) {
    try {
      if (!new RegExp(`^(?:${field.pattern})$`).test(s)) return { ok: false, reasonKey: 'reason.pattern' };
    } catch { /* invalid pattern on the page: ignore */ }
  }
  return { ok: true };
}
