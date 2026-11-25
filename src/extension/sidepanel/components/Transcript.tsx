import type { ChatLine } from '@/services/ai/conversationEngine';

export default function Transcript({ lines, youLabel }: { lines: ChatLine[]; youLabel: string }) {
  const shown = lines.slice(-6);
  if (!shown.length) return null;
  return (
    <ol className="space-y-2" aria-label="Conversation">
      {shown.map((l, i) => (
        <li key={`${l.at}-${i}`} className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm ${l.role === 'user' ? 'ml-auto bg-brand text-white' : 'bg-slate-100 text-ink'}`}>
          {l.role === 'user' && <span className="sr-only">{youLabel}: </span>}
          {l.text}
        </li>
      ))}
    </ol>
  );
}
