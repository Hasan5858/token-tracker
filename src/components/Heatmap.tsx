import { useEffect, useMemo, useRef, useState } from 'react';
import type { Daily } from '../lib/api';
import { full, human, shortDate } from '../lib/format';

const LEVELS = ['#161a1f', '#2b3a12', '#4d6a17', '#7fa81f', '#b5e02e', '#d4ff3a'];
const DOW = ['Mon', '', 'Wed', '', 'Fri', '', ''];

/** GitHub-style calendar (weeks as columns, Mon-first), quantile-scaled. */
export function Heatmap({ d }: { d: Daily }) {
  const [hover, setHover] = useState<{ date: string; total: number } | null>(null);
  const { weeks, thresholds, months, best, streak, active } = useMemo(() => {
    const days = d.days;
    const vals = days.map((x) => x.total).filter((v) => v > 0).sort((a, b) => a - b);
    const q = (p: number) => vals[Math.min(vals.length - 1, Math.floor(p * vals.length))] ?? 0;
    const thresholds = [q(0.2), q(0.45), q(0.7), q(0.9)];
    const first = days[0] ? new Date(days[0].date + 'T00:00:00Z') : new Date();
    const pad = (first.getUTCDay() + 6) % 7;
    const cells: ({ date: string; total: number } | null)[] = [...Array(pad).fill(null), ...days.map((x) => ({ date: x.date, total: x.total }))];
    const weeks: (typeof cells)[] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    const months: { i: number; label: string }[] = [];
    let last = '';
    weeks.forEach((w, i) => {
      const c = w.find(Boolean);
      if (!c) return;
      const m = c.date.slice(0, 7);
      if (m !== last) { months.push({ i, label: shortDate(c.date).split(' ')[0] }); last = m; }
    });
    let best = days[0] ?? null;
    for (const x of days) if (!best || x.total > best.total) best = x;
    let streak = 0;
    for (let i = days.length - 1; i >= 0 && days[i].total > 0; i--) streak++;
    return { weeks, thresholds, months, best, streak, active: vals.length };
  }, [d]);
  const level = (v: number) => (v <= 0 ? 0 : 1 + thresholds.filter((t) => v > t).length);
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(900);
  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);
  const GAP = 3;
  const CELL = Math.max(11, Math.min(26, Math.floor((w - 40) / Math.max(1, weeks.length) - GAP)));
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-ink-400">
        <span><span className="num text-ink-100">{active}</span> active days</span>
        <span><span className="num text-ink-100">{streak}</span> day streak</span>
        {best && best.total > 0 && <span>peak <span className="num text-signal">{human(best.total, 2)}</span> on {shortDate(best.date)}</span>}
        <span className="ml-auto num min-h-[16px] text-ink-300">{hover ? `${shortDate(hover.date)} · ${full(hover.total)} tokens` : ''}</span>
      </div>
      <div ref={box} className="scroll-thin overflow-x-auto pb-2">
        <div className="inline-flex gap-2">
          <div className="flex flex-col pt-[18px]" style={{ gap: GAP }}>
            {DOW.map((l, i) => <div key={i} className="text-[10px] leading-none text-ink-400" style={{ height: CELL, lineHeight: `${CELL}px` }}>{l}</div>)}
          </div>
          <div>
            <div className="relative h-[18px]">
              {months.map((m) => (
                <span key={m.i} className="absolute whitespace-nowrap text-[10px] text-ink-400" style={{ left: m.i * (CELL + GAP) }}>{m.label}</span>
              ))}
            </div>
            <div className="flex" style={{ gap: GAP }}>
              {weeks.map((w, wi) => (
                <div key={wi} className="flex flex-col" style={{ gap: GAP }}>
                  {Array.from({ length: 7 }, (_, di) => {
                    const c = w[di];
                    if (!c) return <div key={di} style={{ width: CELL, height: CELL }} />;
                    const lv = level(c.total);
                    return (
                      <div key={di} onMouseEnter={() => setHover(c)} onMouseLeave={() => setHover(null)}
                        className="rounded-[3px] transition-transform hover:scale-125 hover:ring-1 hover:ring-ink-100/60"
                        style={{ width: CELL, height: CELL, background: LEVELS[lv], boxShadow: lv >= 4 ? '0 0 8px rgba(212,255,58,0.35)' : undefined }}
                        title={`${c.date}: ${full(c.total)}`} />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px] text-ink-400">
        less {LEVELS.map((c) => <span key={c} className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: c }} />)} more
      </div>
    </div>
  );
}
