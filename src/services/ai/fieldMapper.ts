import type { FormField } from '@/types/form';
import type { UserProfile } from '@/types/session';
import { bestOption } from './answerExtractor';
import { similarity } from '@/utils/text';

export interface ProfileSuggestion { value: string | string[] | boolean; display: string; profileLabel: string }

/** Maps a field to a saved profile value. Suggestions are always OFFERED, never filled silently. */
export function suggestFromProfile(field: FormField, profile: UserProfile | null, enabled: boolean): ProfileSuggestion | null {
  if (!enabled || !profile || field.manualOnly || field.inputType === 'file' || field.sensitive) return null;
  const name = profile.fullName.trim();
  const parts = name.split(/\s+/).filter(Boolean);
  let v = '';
  let label = field.label;
  switch (field.semanticType) {
    case 'full_name': v = name; break;
    case 'first_name': v = parts[0] || ''; break;
    case 'last_name': v = parts.length > 1 ? parts[parts.length - 1] : ''; break;
    case 'email': v = profile.email; break;
    case 'phone': v = profile.phone; break;
    case 'address': v = profile.address; break;
    case 'education': v = profile.education; break;
    case 'skills': v = profile.skills; break;
    case 'experience': v = profile.experience; break;
    case 'summary': v = profile.summary; break;
    case 'language': v = profile.languages; break;
    case 'dob': v = profile.dob; break;
    case 'gender': v = profile.gender; break;
    default: {
      const hit = profile.commonAnswers.find((a) => a.value && similarity(a.label, field.label) >= 0.8);
      if (hit) { v = hit.value; label = hit.label; }
    }
  }
  v = v.trim();
  if (!v) return null;
  if (field.inputType === 'select' || field.inputType === 'radio') {
    const m = bestOption(v, field.options).match;
    if (!m || m.score < 0.8) return null;
    return { value: m.option.value, display: m.option.label, profileLabel: label };
  }
  if (field.inputType === 'checkbox' || field.inputType === 'checkbox-group' || field.inputType === 'multiselect') return null;
  if (field.inputType === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  if (field.maxLength && v.length > field.maxLength) return null;
  return { value: v, display: v, profileLabel: label };
}

/** Human readable version of a value, for confirmations and review lists. */
export function displayValue(field: FormField, value: FormField['value']): string {
  if (typeof value === 'boolean') return value ? '✓' : '—';
  if (Array.isArray(value)) return value.map((v) => field.options.find((o) => o.value === v)?.label ?? v).join(', ');
  if ((field.inputType === 'select' || field.inputType === 'radio') && value) return field.options.find((o) => o.value === value)?.label ?? String(value);
  return String(value ?? '');
}
