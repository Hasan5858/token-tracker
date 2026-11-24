import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { delta } from '../lib/format';

export function Panel({ title, icon, right, children, className = '', delay = 0 }: {
  title?: ReactNode; icon?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; delay?: number;
}) {
  return (
    <section className={`panel tick-corner animate-rise p-5 ${className}`} style={{ animationDelay: `${delay}ms` }}>
      {(title || right) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 label">
            {icon && <span className="text-ink-300 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
            {title}
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Delta({ cur, prev, suffix }: { cur: number; prev: number; suffix?: string }) {
  const d = delta(cur, prev);
  const Icon = d.dir === 'up' ? ArrowUpRight : d.dir === 'down' ? ArrowDownRight : Minus;
  const cls = d.dir === 'up' ? 'text-signal bg-signal/10' : d.dir === 'down' ? 'text-rose bg-rose/10' : 'text-ink-300 bg-ink-700/50';
  return (
    <span className={`num inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>
      <Icon className="h-3 w-3" strokeWidth={2.5} />
      {d.text}
      {suffix && <span className="ml-1 font-sans text-ink-400">{suffix}</span>}
    </span>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: {
  value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-ink-700 bg-ink-900/80 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            value === o.value ? 'bg-ink-700 text-ink-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]' : 'text-ink-400 hover:text-ink-100'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-ink-800 ${className}`} />;
}

export function Dot({ color }: { color: string }) {
  return <span className="inline-block h-2 w-2 shrink-0 rounded-[3px]" style={{ background: color, boxShadow: `0 0 10px ${color}66` }} />;
}
