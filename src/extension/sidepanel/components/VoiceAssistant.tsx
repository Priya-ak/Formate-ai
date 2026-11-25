import { Mic, MicOff, Square, Loader2, Volume2 } from 'lucide-react';
import type { VoiceStatus } from '@/types/voice';
import { Waveform } from '@/components/ui';

interface Props {
  status: VoiceStatus;
  busy: boolean;
  interim: string;
  canListen: boolean;
  onMic: () => void;
  onStop: () => void;
  labels: { listening: string; speaking: string; processing: string; tap: string; stop: string };
}

export default function VoiceAssistant({ status, busy, interim, canListen, onMic, onStop, labels }: Props) {
  const listening = status === 'listening';
  const speaking = status === 'speaking';
  const text = busy ? labels.processing : listening ? labels.listening : speaking ? labels.speaking : canListen ? labels.tap : '';
  return (
    <div className="flex flex-col items-center gap-3 py-2" data-testid="voice-assistant">
      <button
        type="button"
        onClick={listening ? onStop : onMic}
        disabled={!canListen || busy}
        aria-label={listening ? labels.stop : labels.tap}
        aria-pressed={listening}
        className={`relative flex h-24 w-24 items-center justify-center rounded-full text-white shadow-soft transition disabled:opacity-40 ${listening ? 'bg-bad fm-pulse' : 'bg-gradient-to-br from-brand to-violet2'}`}
      >
        {busy ? <Loader2 className="h-10 w-10 animate-spin" aria-hidden /> : listening ? <Square className="h-9 w-9" aria-hidden /> : canListen ? <Mic className="h-10 w-10" aria-hidden /> : <MicOff className="h-10 w-10" aria-hidden />}
      </button>
      <div className="flex items-center gap-2 text-sm font-semibold" role="status" aria-live="polite">
        {speaking && <Volume2 className="h-4 w-4" aria-hidden />}
        {text}
      </div>
      <Waveform active={listening || speaking} />
      {interim && <p className="w-full rounded-xl bg-slate-100 px-3 py-2 text-center text-sm italic" aria-live="polite">“{interim}”</p>}
    </div>
  );
}
