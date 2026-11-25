import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-white border-brand hover:bg-brand-600',
  secondary: 'bg-white text-ink border-slate-300 hover:bg-slate-50',
  ghost: 'bg-transparent text-ink border-transparent hover:bg-slate-100',
  danger: 'bg-white text-bad border-bad hover:bg-red-50',
  success: 'bg-ok text-white border-ok hover:opacity-90',
};

export function Button({ variant = 'secondary', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...p}
      className={`fm-btn inline-flex items-center justify-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    />
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`fm-card rounded-2xl bg-white p-4 shadow-soft border border-slate-100 ${className}`}>{children}</section>;
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex items-start justify-between gap-4 py-2 cursor-pointer">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="fm-muted block text-xs text-slate-500 mt-0.5">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" className="mt-1 h-5 w-5 accent-[#5B5CE2] shrink-0" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function Select<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <label className="block py-1">
      <span className="block text-sm font-medium mb-1">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function TextInput({ label, value, onChange, type = 'text', placeholder, multiline, hint, autoComplete }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; multiline?: boolean; hint?: string; autoComplete?: string;
}) {
  const cls = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm';
  return (
    <label className="block py-1">
      <span className="block text-sm font-medium mb-1">{label}</span>
      {multiline
        ? <textarea className={cls} rows={3} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        : <input className={cls} type={type} value={value} placeholder={placeholder} autoComplete={autoComplete ?? 'off'} onChange={(e) => onChange(e.target.value)} />}
      {hint && <span className="fm-muted block text-xs text-slate-500 mt-1">{hint}</span>}
    </label>
  );
}

export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'ok' | 'warn' | 'bad' | 'brand' }) {
  const t = { neutral: 'bg-slate-100 text-slate-700', ok: 'bg-green-100 text-green-800', warn: 'bg-amber-100 text-amber-900', bad: 'bg-red-100 text-red-800', brand: 'bg-brand-50 text-brand-600' }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${t}`}>{children}</span>;
}

export function Waveform({ active }: { active: boolean }) {
  return (
    <div className="flex items-end justify-center gap-1 h-8" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <span key={i} className={`w-1.5 rounded-full bg-violet2 ${active ? 'fm-bar' : ''}`} style={{ height: active ? '100%' : '25%', animationDelay: `${i * 0.12}s` }} />
      ))}
    </div>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2 font-bold text-ink">
      <span className="inline-flex items-center justify-center rounded-lg bg-gradient-to-br from-brand to-violet2" style={{ width: size, height: size }}>
        <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
        </svg>
      </span>
      FormMate
    </span>
  );
}
