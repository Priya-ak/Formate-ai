import { ArrowLeft, RotateCcw, SkipForward, ChevronRight } from 'lucide-react';
import type { EngineState } from '@/services/ai/conversationEngine';
import { Button, Pill } from '@/components/ui';

interface Props {
  state: EngineState;
  onAnswer: (text: string) => void;
  onRepeat: () => void;
  onSkip: () => void;
  onBack: () => void;
  L: (k: string, v?: Record<string, string | number>) => string;
}

export default function CurrentQuestion({ state, onAnswer, onRepeat, onSkip, onBack, L }: Props) {
  const f = state.current;
  if (!f) return null;
  const chooser = ['select', 'radio', 'multiselect', 'checkbox-group'].includes(f.inputType);
  const yesNo = f.inputType === 'checkbox';
  return (
    <div className="space-y-3" data-testid="current-question">
      <div className="flex flex-wrap items-center gap-2">
        {f.section && <Pill tone="brand">{f.section}</Pill>}
        <Pill tone={f.required ? 'warn' : 'neutral'}>{f.required ? '★ Required' : 'Optional'}</Pill>
      </div>
      <p className="text-lg font-semibold leading-snug" aria-live="polite" data-testid="assistant-message">{state.message}</p>
      <p className="fm-muted text-xs text-slate-500">{f.label}{f.helpText ? ` — ${f.helpText}` : ''}</p>

      {state.isNotice && (
        <Button variant="primary" className="w-full" onClick={onSkip}><ChevronRight className="h-4 w-4" aria-hidden />{L('ui.done')}</Button>
      )}
      {chooser && !state.isNotice && (
        <div className="flex flex-wrap gap-2" role="group" aria-label={f.label}>
          {f.options.filter((o) => !o.disabled).slice(0, 12).map((o) => (
            <Button key={o.value} onClick={() => onAnswer(o.label)}>{o.label}</Button>
          ))}
        </div>
      )}
      {yesNo && (
        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" onClick={() => onAnswer('yes')}>{L('ui.yes')}</Button>
          <Button className="flex-1" onClick={() => onAnswer('no')}>No</Button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" onClick={onBack} disabled={!state.canGoBack}><ArrowLeft className="h-4 w-4" aria-hidden />{L('ui.back')}</Button>
        <Button variant="ghost" onClick={onRepeat}><RotateCcw className="h-4 w-4" aria-hidden />{L('ui.repeat')}</Button>
        {!state.isNotice && <Button variant="ghost" onClick={onSkip}><SkipForward className="h-4 w-4" aria-hidden />{L('ui.skip')}</Button>}
      </div>
    </div>
  );
}
