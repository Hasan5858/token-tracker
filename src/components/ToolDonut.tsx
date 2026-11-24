import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import type { Summary } from '../lib/api';
import { human, pct } from '../lib/format';
import { TOOL_COLOR, TOOL_LABEL, sourceColor, sourceLabel } from '../lib/colors';
import { Dot } from './ui';

export function ToolDonut({ s }: { s: Summary }) {
  const [active, setActive] = useState<number | null>(null);
  const data = s.byTool.map((t) => ({ name: t.tool, value: t.total }));
  const total = data.reduce((a, b) => a + b.value, 0) || 1;
  const focus = active != null ? data[active] : null;
  const profKeys = s.byProfile.map((p) => p.key);
  return (
    <div className="flex flex-col gap-5">
      <div className="relative mx-auto h-[200px] w-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={70} outerRadius={94} paddingAngle={2} stroke="none"
              startAngle={90} endAngle={-270} animationDuration={900}
              onMouseEnter={(_, i) => setActive(i)} onMouseLeave={() => setActive(null)}>
              {data.map((d, i) => (
                <Cell key={d.name} fill={TOOL_COLOR[d.name] ?? '#888'} opacity={active == null || active === i ? 1 : 0.3} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="label">{focus ? TOOL_LABEL[focus.name] : 'Range total'}</span>
          <span className="num mt-1 text-2xl font-semibold">{human(focus ? focus.value : total, 2)}</span>
          {focus && <span className="num text-xs text-ink-400">{pct(focus.value / total)}</span>}
        </div>
      </div>
      <div className="space-y-2">
        {s.byProfile.map((p) => (
          <div key={p.key} className="group">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-ink-300"><Dot color={sourceColor(p.key, profKeys)} />{sourceLabel(p.key)}</span>
              <span className="num text-ink-100">{human(p.total)} <span className="text-ink-400">· {pct(p.total / total, 0)}</span></span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-ink-800">
              <div className="h-full rounded-full transition-[width] duration-1000" style={{ width: `${(p.total / total) * 100}%`, background: sourceColor(p.key, profKeys) }} />
            </div>
          </div>
        ))}
        {!s.byProfile.length && <div className="text-sm text-ink-400">No usage in range.</div>}
      </div>
    </div>
  );
}
