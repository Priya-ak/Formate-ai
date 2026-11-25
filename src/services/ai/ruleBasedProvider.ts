import type { AIProvider, ExtractionRequest, ExtractionResult } from '@/types/ai';
import type { FormField } from '@/types/form';
import { extractAnswer } from './answerExtractor';

/** Offline provider. Always available; no network, no keys. */
export class RuleBasedProvider implements AIProvider {
  readonly id = 'rules' as const;
  readonly available = true;

  async extract(req: ExtractionRequest): Promise<ExtractionResult> {
    const f = req.field;
    // Build a minimal FormField view for the rule engine.
    const field = {
      fieldId: f.fieldId, label: f.label, semanticType: f.semanticType, inputType: f.inputType, required: f.required,
      placeholder: f.placeholder, maxLength: f.maxLength, helpText: f.helpText,
      options: f.options, value: '', section: '', status: 'pending', confidence: 1, classifiedBy: 'rules', sensitive: false,
      manualOnly: false, legal: false, name: '', htmlId: '', disabled: false, readOnly: false, prefilled: false, orderIndex: 0, key: f.fieldId,
    } as FormField;
    return extractAnswer(field, req.userAnswer);
  }
}
