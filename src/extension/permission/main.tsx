import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@/index.css';
import { Mic } from 'lucide-react';
import { Button, Card, Logo } from '@/components/ui';

function PermissionPage() {
  const [result, setResult] = useState<'idle' | 'granted' | 'denied' | 'missing'>('idle');
  async function ask() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
      setResult('granted');
    } catch (e) {
      setResult((e as DOMException).name === 'NotFoundError' ? 'missing' : 'denied');
    }
  }
  return (
    <main className="mx-auto max-w-md space-y-4 p-6">
      <Logo />
      <Card className="space-y-3">
        <h1 className="text-xl font-bold">Allow microphone access</h1>
        <p className="text-sm">FormMate uses your microphone only while you are answering a question. Audio is handled by your browser’s speech recognition and is never stored by FormMate.</p>
        <Button variant="primary" onClick={() => void ask()}><Mic className="h-4 w-4" aria-hidden />Allow microphone</Button>
        {result === 'granted' && <p role="status" className="text-sm font-semibold text-ok">✔ Microphone allowed. You can close this tab and return to your form.</p>}
        {result === 'denied' && <p role="alert" className="text-sm text-bad">Microphone is blocked. Click the lock icon in the address bar, set Microphone to Allow, then try again. You can also type your answers.</p>}
        {result === 'missing' && <p role="alert" className="text-sm text-bad">No microphone was found. Connect one, or type your answers instead.</p>}
      </Card>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><PermissionPage /></StrictMode>);
