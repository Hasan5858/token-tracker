import { useCountUp } from '../lib/useCountUp';
import { full, human, humanParts, pct, shortDate } from '../lib/format';
import type { Summary } from '../lib/api';
import { Delta } from './ui';

const SEG = [
  { k: 'cacheRead', label: 'Cache read', color: '#3ad0ff' },
  { k: 'input', label: 'Fresh input', color: '#d4ff3a' },
  { k: 'output', label: 'Output', color: '#ff8a3d' },
  { k: 'cacheWrite', label: 'Cache write', color: '#ff5c7a' },
] as const;

export function Hero({ s, hourly }: { s: Summary; hourly: number[] }) {
  const t = s.today;
  const v = useCountUp(t.total, 1600);
  const parts = humanParts(v);
  const sum = SEG.reduce((a, x) => a + (t[x.k] || 0), 0) || 1;
  const promptSide = t.input + t.cacheRead + t.cacheWrite;
  const hit = promptSide ? t.cacheRead / promptSide : 0;
  return (
    <section className="panel tick-corner animate-rise relative overflow-hidden p-6 md:p-8">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-signal/10 blur-3xl" />
      <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 label">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-signal shadow-[0_0_8px_#d4ff3a]" />
            Tokens today · {shortDate(t.date)}
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="num font-display text-[64px] font-semibold leading-none text-ink-100 sm:text-[88px] md:text-[112px]" style={{ letterSpacing: '-0.05em' }}>
              {parts.value}
            </span>
            <span className="num text-4xl font-semibold text-signal sm:text-5xl md:text-6xl">{parts.unit}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-300">
            <span className="num text-ink-400">{full(t.total)} tokens</span>
            <Delta cur={t.total} prev={s.yesterday.total} suffix="vs yesterday" />
            <span><span className="num text-ink-100">{full(t.calls)}</span> calls</span>
            <span><span className="num text-ink-100">{t.sessions}</span> sessions</span>
            <span><span className="num text-ink-100">{pct(hit, 0)}</span> cache hit</span>
          </div>
        </div>
        <HourStrip hourly={hourly} />
      </div>
      <div className="mt-8">
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-ink-800">
          {SEG.map((x) => (
            <div key={x.k} className="h-full transition-[width] duration-1000" style={{ width: `${((t[x.k] || 0) / sum) * 100}%`, background: x.color }} />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SEG.map((x) => (
            <div key={x.k} className="flex items-center justify-between gap-2 rounded-lg border border-ink-700/60 bg-ink-900/50 px-2.5 py-2 sm:px-3">
              <span className="flex items-center gap-2 whitespace-nowrap text-xs text-ink-300">
                <span className="h-2 w-2 rounded-sm" style={{ background: x.color }} />
                {x.label}
              </span>
              <span className="num text-sm text-ink-100">{human(t[x.k])}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** 24 vertical bars: today's tokens by hour (local). */
function HourStrip({ hourly }: { hourly: number[] }) {
  const max = Math.max(1, ...hourly);
  const nowH = new Date().getHours();
  return (
    <div className="w-full max-w-md shrink-0">
      <div className="mb-2 flex justify-between label"><span>By hour</span><span className="num normal-case tracking-normal">peak {human(max)}</span></div>
      <div className="flex h-24 items-end gap-[3px]">
        {hourly.map((v, h) => (
          <div key={h} className="group relative flex-1">
            <div
              className="w-full rounded-[2px] transition-all duration-700"
              style={{
                height: `${Math.max(3, (v / max) * 96)}px`,
                background: h === nowH ? '#d4ff3a' : v ? 'linear-gradient(180deg,#d4ff3acc,#d4ff3a33)' : '#1c2127',
              }}
            />
            <div className="num pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-ink-700 px-1.5 py-0.5 text-[10px] group-hover:block">
              {String(h).padStart(2, '0')}:00 · {human(v)}
            </div>
          </div>
        ))}
      </div>
      <div className="num mt-1.5 flex justify-between text-[10px] text-ink-400"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
    </div>
  );
}
