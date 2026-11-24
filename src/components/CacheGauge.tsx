import type { Totals } from '../lib/api';
import { TOOL_COLOR, TOOL_LABEL } from '../lib/colors';
import { human, pct } from '../lib/format';
import { useCountUp } from '../lib/useCountUp';

/** Semi-circular gauge: share of prompt tokens served from cache. */
export function CacheGauge({ t, byTool = [] }: { t: Totals; byTool?: (Totals & { tool: string })[] }) {
  const prompt = t.input + t.cacheRead + t.cacheWrite;
  const ratio = prompt ? t.cacheRead / prompt : 0;
  const v = useCountUp(ratio, 1400);
  const R = 80, C = Math.PI * R;
  const ticks = Array.from({ length: 21 }, (_, i) => i / 20);
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 118" className="w-full max-w-[260px]">
        <defs>
          <linearGradient id="gauge" x1="0" x2="1">
            <stop offset="0%" stopColor="#3ad0ff" />
            <stop offset="100%" stopColor="#d4ff3a" />
          </linearGradient>
        </defs>
        {ticks.map((p) => {
          const a = Math.PI * (1 - p);
          const r1 = 94, r2 = p % 0.25 === 0 ? 86 : 90;
          return <line key={p} x1={100 + r1 * Math.cos(a)} y1={100 - r1 * Math.sin(a)} x2={100 + r2 * Math.cos(a)} y2={100 - r2 * Math.sin(a)} stroke="#2e353e" strokeWidth={1} />;
        })}
        <path d={`M ${100 - R} 100 A ${R} ${R} 0 0 1 ${100 + R} 100`} fill="none" stroke="#161a1f" strokeWidth={12} strokeLinecap="round" />
        <path d={`M ${100 - R} 100 A ${R} ${R} 0 0 1 ${100 + R} 100`} fill="none" stroke="url(#gauge)" strokeWidth={12} strokeLinecap="round"
          strokeDasharray={`${C * v} ${C}`} style={{ filter: 'drop-shadow(0 0 6px rgba(212,255,58,0.35))' }} />
        <text x="100" y="90" textAnchor="middle" className="num" fill="#e6e9ec" fontSize="30" fontWeight="600">{(v * 100).toFixed(1)}%</text>
        <text x="100" y="110" textAnchor="middle" fill="#6b7581" fontSize="9" letterSpacing="1.5">CACHE HIT RATIO</text>
      </svg>
      <div className="mt-3 grid w-full grid-cols-3 gap-2 text-center">
        {[
          ['Cached', t.cacheRead, '#3ad0ff'],
          ['Fresh', t.input, '#d4ff3a'],
          ['Written', t.cacheWrite, '#ff5c7a'],
        ].map(([l, n, c]) => (
          <div key={l as string} className="rounded-lg border border-ink-700/60 bg-ink-900/50 py-2">
            <div className="text-[10px] uppercase tracking-wider" style={{ color: c as string }}>{l}</div>
            <div className="num mt-0.5 text-sm">{human(n as number)}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-[11px] leading-relaxed text-ink-400">
        {prompt ? `${pct(ratio, 0)} of ${human(prompt)} prompt tokens were cache reads.` : 'No prompt tokens in range.'}
      </p>
      {byTool.length > 0 && (
        <div className="mt-4 w-full space-y-2.5 border-t border-ink-700/60 pt-4">
          {byTool.map((b) => {
            const p = b.input + b.cacheRead + b.cacheWrite;
            const r = p ? b.cacheRead / p : 0;
            return (
              <div key={b.tool}>
                <div className="flex justify-between text-xs"><span className="text-ink-300">{TOOL_LABEL[b.tool]}</span><span className="num text-ink-100">{pct(r, 1)}</span></div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-ink-800"><div className="h-full rounded-full transition-[width] duration-1000" style={{ width: `${r * 100}%`, background: TOOL_COLOR[b.tool] }} /></div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
