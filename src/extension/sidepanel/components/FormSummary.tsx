import { BookmarkPlus, ShieldCheck, RefreshCw } from 'lucide-react';
import type { ReviewSummary } from '@/types/session';
import { Button, Card } from '@/components/ui';

interface Props {
  review: ReviewSummary;
  hasCaptcha: boolean;
  saved: boolean;
  onSave: () => void;
  onRescan: () => void;
  L: (k: string, v?: Record<string, string | number>) => string;
}

export default function FormSummary({ review, hasCaptcha, saved, onSave, onRescan, L }: Props) {
  const attention = review.missing.length + review.invalid.length + review.manual.filter((f) => f.required || f.inputType === 'file').length;
  const ready = attention === 0;
  return (
    <Card className={ready ? 'border-ok' : 'border-warn'}>
      <h2 className="text-lg font-bold" data-testid="summary-title">
        {ready ? 'All set — review and submit yourself' : `${review.completed.length} fields completed. ${attention} need your attention.`}
      </h2>
      <p className="mt-1 text-sm text-slate-600 fm-muted">
        {ready ? 'Everything required is filled in. Check the form once more, then click the website’s own submit button.' : 'The form is not complete yet. Fix the items below, then submit it yourself.'}
      </p>
      {hasCaptcha && <p className="mt-2 text-sm font-semibold text-amber-800">This page has a security check (CAPTCHA). Please complete it yourself.</p>}
      <p className="mt-2 flex items-start gap-2 text-sm"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden />FormMate never submits forms for you.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={onSave} disabled={saved}><BookmarkPlus className="h-4 w-4" aria-hidden />{saved ? 'Saved on this device' : L('ui.saveLater')}</Button>
        <Button variant="ghost" onClick={onRescan}><RefreshCw className="h-4 w-4" aria-hidden />Refresh</Button>
      </div>
    </Card>
  );
}
