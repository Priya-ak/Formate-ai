export type SemanticType =
  | 'full_name' | 'first_name' | 'last_name' | 'email' | 'phone' | 'address' | 'street' | 'city' | 'state'
  | 'postal_code' | 'country' | 'dob' | 'gender' | 'education' | 'institution' | 'graduation_year'
  | 'skills' | 'experience' | 'years_experience' | 'summary' | 'why_apply' | 'availability' | 'start_date'
  | 'salary_expectation' | 'linkedin' | 'website' | 'resume_upload' | 'consent' | 'terms'
  | 'password' | 'captcha' | 'otp' | 'id_number' | 'payment' | 'job_role' | 'company' | 'language'
  | 'generic_text' | 'generic_choice' | 'generic_date' | 'generic_number' | 'generic_file' | 'generic_boolean';

export type InputKind =
  | 'text' | 'textarea' | 'email' | 'tel' | 'number' | 'date' | 'time' | 'url'
  | 'select' | 'multiselect' | 'radio' | 'checkbox' | 'checkbox-group' | 'file' | 'contenteditable';

export type FieldStatus =
  | 'pending' | 'asked' | 'answered' | 'filled' | 'confirmed' | 'skipped' | 'needs_attention' | 'error';

export interface FieldOption { value: string; label: string; disabled?: boolean }

/** Plain-data description of a form field (no DOM references; safe to send over messaging). */
export interface FormField {
  fieldId: string;
  label: string;
  semanticType: SemanticType;
  inputType: InputKind;
  required: boolean;
  value: string | string[] | boolean;
  placeholder: string;
  options: FieldOption[];
  section: string;
  status: FieldStatus;
  confidence: number;
  /** Where the semantic type came from: autocomplete | type | label | name | context | fallback. */
  classifiedBy: string;
  sensitive: boolean;
  /** Fields FormMate must never fill (password, card, OTP, CAPTCHA). */
  manualOnly: boolean;
  /** Legally significant checkbox (terms, consent, declaration). */
  legal: boolean;
  name: string;
  htmlId: string;
  helpText: string;
  min?: string; max?: string; minLength?: number; maxLength?: number; pattern?: string; step?: string;
  multiple?: boolean;
  disabled: boolean;
  readOnly: boolean;
  /** Value was already present when detected (typed by the user or pre-filled by the site). */
  prefilled: boolean;
  orderIndex: number;
  /** Stable key across rescans/steps: semantic type + normalized label + name. */
  key: string;
  note?: string;
  validationError?: string;
}

export interface StepInfo {
  isMultiStep: boolean;
  current?: number;
  total?: number;
  nextLabel?: string;
  prevLabel?: string;
}

export interface FormSchema {
  formId: string;
  title: string;
  host: string;
  url: string;
  kind: 'job' | 'education' | 'government' | 'healthcare' | 'registration' | 'contact' | 'other';
  fields: FormField[];
  step: StepInfo;
  hasCaptcha: boolean;
  /** Number of controls we saw but cannot operate (custom widgets, iframes, files...). */
  unsupportedCount: number;
  detectedAt: number;
}

export interface FillResult {
  ok: boolean;
  fieldId: string;
  /** Value actually present in the page after filling (verified). */
  actual?: string | string[] | boolean;
  error?: string;
  /** Website validation message after fill, if any. */
  validationError?: string;
  /** The website reset the value after we set it. */
  resetByPage?: boolean;
}
