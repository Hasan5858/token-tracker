import { CalendarDays, CalendarRange, Infinity as InfinityIcon, Sun } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Daily, Summary, Totals } from '../lib/api';
import { full, human, pct } from '../lib/format';
import { Delta } from './ui';
import { Sparkline } from './Sparkline';

export function KpiCards({ s, all }: { s: Summary; all: Daily | null }) {
  const days = all?.days ?? [];
  const series = (n: number) => days.slice(-n).map((d) => d.total);
  // previous periods computed from the full daily series
  const sumSlice = (a: number, b: number) => days.slice(Math.max(0, days.length - b), days.length - a).reduce((x, d) => x + d.total, 0);
  const cards: { label: string; icon: ReactNode; t: Totals; prev: number | null; spark: number[]; color: string; note: string }[] = [
    { label: 'Today', icon: <Sun />, t: s.today, prev: s.yesterday.total, spark: series(14), color: '#d4ff3a', note: 'vs yesterday' },
    { label: 'Last 7 days', icon: <CalendarDays />, t: s.last7, prev: sumSlice(7, 14), spark: series(14), color: '#3ad0ff', note: 'vs prior 7d' },
    { label: 'Last 30 days', icon: <CalendarRange />, t: s.last30, prev: sumSlice(30, 60), spark: series(30), color: '#ff8a3d', note: 'vs prior 30d' },
    { label: 'All time', icon: <InfinityIcon />, t: s.allTime, prev: null, spark: series(days.length), color: '#e6e9ec', note: s.firstDate ? `since ${s.firstDate}` : '' },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((c, i) => {
        const prompt = c.t.input + c.t.cacheRead + c.t.cacheWrite;
        return (
          <div key={c.label} className="panel tick-corner animate-rise flex flex-col p-4" style={{ animationDelay: `${80 + i * 60}ms` }}>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 label [&>svg]:h-3.5 [&>svg]:w-3.5">{c.icon}{c.label}</span>
              {c.prev != null ? <Delta cur={c.t.total} prev={c.prev} /> : <span className="text-[11px] text-ink-400">{c.note}</span>}
            </div>
            <div className="mt-3 flex items-baseline justify-between gap-2">
              <span className="num text-3xl font-semibold text-ink-100" title={full(c.t.total)}>{human(c.t.total, 2)}</span>
              <span className="num text-xs text-ink-400">{full(c.t.calls)} calls</span>
            </div>
            <div className="mt-1 flex gap-3 text-[11px] text-ink-400">
              <span>in <span className="num text-ink-300">{human(c.t.input)}</span></span>
              <span>out <span className="num text-ink-300">{human(c.t.output)}</span></span>
              <span>cache <span className="num text-ink-300">{prompt ? pct(c.t.cacheRead / prompt, 0) : '—'}</span></span>
            </div>
            <div className="mt-auto pt-3"><Sparkline data={c.spark} color={c.color} height={38} /></div>
          </div>
        );
      })}
    </div>
  );
}
