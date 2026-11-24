import { useState } from 'react';
import type { Summary } from '../lib/api';
import { full, human, pct } from '../lib/format';
import { TOOL_COLOR, TOOL_LABEL } from '../lib/colors';

export function ModelBoard({ s }: { s: Summary }) {
  const [more, setMore] = useState(false);
  const rows = more ? s.byModel : s.byModel.slice(0, 10);
  // sqrt scale so mid-size models stay readable next to a dominant one
  const max = Math.sqrt(Math.max(1, ...s.byModel.map((r) => r.total)));
  const w = (n: number) => `${(Math.sqrt(Math.max(0, n)) / max) * 100}%`;
  return (
    <div className="space-y-1">
      {rows.map((m, i) => {
        const prompt = m.input + m.cacheRead + m.cacheWrite;
        const c = TOOL_COLOR[m.tool] ?? '#888';
        return (
          <div key={m.model + m.tool} className="group relative rounded-lg px-2 py-2 transition hover:bg-ink-800/60">
            <div className="flex items-center gap-3">
              <span className="num w-5 text-right text-xs text-ink-400">{String(i + 1).padStart(2, '0')}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm text-ink-100" title={`${m.model} · ${m.providers}`}>{m.model}</span>
                  <span className="num shrink-0 text-sm text-ink-100" title={full(m.total)}>{human(m.total, 2)}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-ink-800">
                    <div className="absolute inset-y-0 left-0 rounded-full opacity-45" style={{ width: w(m.total), background: c }} />
                    <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: w(m.input + m.output), background: c }} />
                  </div>
                  <span className="w-[86px] shrink-0 text-right text-[10px] uppercase tracking-wider" style={{ color: c }}>{TOOL_LABEL[m.tool]}</span>
                </div>
                <div className="mt-1 hidden gap-3 text-[11px] text-ink-400 group-hover:flex">
                  <span>fresh in <span className="num text-ink-300">{human(m.input)}</span></span>
                  <span>out <span className="num text-ink-300">{human(m.output)}</span></span>
                  <span>cache <span className="num text-ink-300">{prompt ? pct(m.cacheRead / prompt, 0) : '—'}</span></span>
                  <span>calls <span className="num text-ink-300">{full(m.calls)}</span></span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <div className="flex items-center justify-between gap-3 pt-2 text-[11px] text-ink-400">
        <span>√-scaled · bar = total incl. cache · bright core = fresh input + output. Hover a row for details.</span>
        {s.byModel.length > 10 && <button onClick={() => setMore((v) => !v)} className="shrink-0 whitespace-nowrap text-ink-300 underline decoration-ink-600 underline-offset-4 hover:text-signal">{more ? 'Top 10' : `All ${s.byModel.length}`}</button>}
      </div>
    </div>
  );
}
