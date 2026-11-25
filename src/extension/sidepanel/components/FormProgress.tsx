import { Check, Circle, AlertTriangle, SkipForward, Hand, Mic, Loader2, XCircle } from 'lucide-react';
import type { FormField, FieldStatus } from '@/types/form';
import type { Progress } from '@/types/session';

const STATUS: Record<FieldStatus, { label: string; Icon: typeof Check; cls: string }> = {
  pending: { label: 'Pending', Icon: Circle, cls: 'text-slate-500' },
  asked: { label: 'Asked', Icon: Mic, cls: 'text-brand' },
  answered: { label: 'Answered', Icon: Loader2, cls: 'text-brand' },
  filled: { label: 'Filled', Icon: Check, cls: 'text-ok' },
  confirmed: { label: 'Confirmed', Icon: Check, cls: 'text-ok' },
  skipped: { label: 'Skipped', Icon: SkipForward, cls: 'text-slate-500' },
  needs_attention: { label: 'Needs attention', Icon: Hand, cls: 'text-amber-600' },
  error: { label: 'Error', Icon: XCircle, cls: 'text-bad' },
};

/** Status is always icon + text, never colour alone. */
export function StatusBadge({ status }: { status: FieldStatus }) {
  const s = STATUS[status];
  return <span className={`inline-flex items-center gap-1 text-xs font-semibold ${s.cls}`}><s.Icon className="h-3.5 w-3.5" aria-hidden />{s.label}</span>;
}

export default function FormProgress({ progress, fields, currentId, label, showList }: { progress: Progress; fields: FormField[]; currentId?: string; label: string; showList?: boolean }) {
  return (
    <div className="space-y-2" data-testid="form-progress">
      <div className="flex items-center justify-between text-sm font-semibold">
        <span>{label}</span><span>{progress.percent}%</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="h-full rounded-full bg-gradient-to-r from-brand to-violet2 transition-all" style={{ width: `${progress.percent}%` }} />
      </div>
      {showList && (
        <ul className="mt-2 max-h-48 space-y-1 overflow-auto pr-1 text-sm">
          {fields.filter((f) => !f.disabled && !f.readOnly).map((f) => (
            <li key={f.fieldId} className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1 ${f.fieldId === currentId ? 'bg-brand-50 font-semibold' : ''}`}>
              <span className="truncate">{f.label}{f.required ? ' *' : ''}</span>
              <StatusBadge status={f.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
