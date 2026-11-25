import { Pencil, Crosshair, SkipForward } from 'lucide-react';
import type { FormField } from '@/types/form';
import type { ReviewSummary } from '@/types/session';
import { displayValue } from '@/services/ai/fieldMapper';
import { Button, Card, Pill } from '@/components/ui';

interface Props {
  review: ReviewSummary;
  onEdit: (id: string) => void;
  onGoTo: (id: string) => void;
  onSkip?: (id: string) => void;
}

function Row({ f, tone, hint, actions }: { f: FormField; tone: 'ok' | 'warn' | 'bad' | 'neutral'; hint?: string; actions: React.ReactNode }) {
  const val = f.manualOnly ? '' : displayValue(f, f.value);
  return (
    <li className="flex items-start justify-between gap-2 border-b border-slate-100 py-2 last:border-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2"><span className="truncate text-sm font-semibold">{f.label}</span><Pill tone={tone}>{f.required ? 'Required' : 'Optional'}</Pill></div>
        {val && <p className="truncate text-sm text-slate-600 fm-muted" title={val}>{f.sensitive ? '•••' : val}</p>}
        {hint && <p className="text-xs text-slate-500 fm-muted">{hint}</p>}
      </div>
      <div className="flex shrink-0 gap-1">{actions}</div>
    </li>
  );
}

function Section({ title, tone, children, count }: { title: string; tone: 'ok' | 'warn' | 'bad' | 'neutral'; count: number; children: React.ReactNode }) {
  if (!count) return null;
  return (
    <Card>
      <h3 className="mb-1 flex items-center gap-2 text-sm font-bold">{title} <Pill tone={tone}>{count}</Pill></h3>
      <ul>{children}</ul>
    </Card>
  );
}

export default function FieldReview({ review, onEdit, onGoTo, onSkip }: Props) {
  const edit = (f: FormField) => <Button key="e" variant="ghost" aria-label={`Edit ${f.label}`} onClick={() => onEdit(f.fieldId)}><Pencil className="h-4 w-4" aria-hidden />Edit</Button>;
  const go = (f: FormField) => <Button key="g" variant="ghost" aria-label={`Go to ${f.label}`} onClick={() => onGoTo(f.fieldId)}><Crosshair className="h-4 w-4" aria-hidden />Go to</Button>;
  return (
    <div className="space-y-3" data-testid="field-review">
      <Section title="Needs your answer" tone="bad" count={review.missing.length}>
        {review.missing.map((f) => <Row key={f.fieldId} f={f} tone="bad" hint="Required and still empty." actions={<>{edit(f)}{go(f)}</>} />)}
      </Section>
      <Section title="Needs attention" tone="bad" count={review.invalid.length}>
        {review.invalid.map((f) => <Row key={f.fieldId} f={f} tone="bad" hint={f.validationError || 'The website did not accept this value.'} actions={<>{edit(f)}{go(f)}</>} />)}
      </Section>
      <Section title="Please do these yourself" tone="warn" count={review.manual.length}>
        {review.manual.map((f) => <Row key={f.fieldId} f={f} tone="warn" hint={f.inputType === 'file' ? 'Choose the file yourself.' : 'Sensitive — fill it yourself.'} actions={go(f)} />)}
      </Section>
      <Section title="Please double-check" tone="warn" count={review.uncertain.length}>
        {review.uncertain.map((f) => <Row key={f.fieldId} f={f} tone="warn" hint="I was not fully sure about this one." actions={<>{edit(f)}{go(f)}</>} />)}
      </Section>
      <Section title="Completed" tone="ok" count={review.completed.length}>
        {review.completed.map((f) => <Row key={f.fieldId} f={f} tone="ok" actions={<>{edit(f)}{go(f)}</>} />)}
      </Section>
      <Section title="Skipped (optional)" tone="neutral" count={review.skipped.length}>
        {review.skipped.map((f) => <Row key={f.fieldId} f={f} tone="neutral" actions={<>{edit(f)}{onSkip && <span className="sr-only"><SkipForward /></span>}</>} />)}
      </Section>
    </div>
  );
}
