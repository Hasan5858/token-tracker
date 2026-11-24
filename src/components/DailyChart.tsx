import { useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AreaChart as AreaIcon, BarChart3 } from 'lucide-react';
import type { Daily } from '../lib/api';
import { human, shortDate, full } from '../lib/format';
import { sourceColor, sourceLabel } from '../lib/colors';
import { Dot, Segmented } from './ui';

export function DailyChart({ d }: { d: Daily }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [kind, setKind] = useState<'bar' | 'area'>(d.days.length > 45 ? 'area' : 'bar');
  const rows = useMemo(() => d.days.map((day) => ({ date: day.date, ...day.sources })), [d]);
  const keys = d.keys;
  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const day of d.days) for (const [k, v] of Object.entries(day.sources)) t[k] = (t[k] ?? 0) + v;
    return t;
  }, [d]);
  const order = [...keys].sort((a, b) => (totals[b] ?? 0) - (totals[a] ?? 0));
  const toggle = (k: string) => setHidden((h) => { const n = new Set(h); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const visible = order.filter((k) => !hidden.has(k));
  const common = {
    data: rows,
    margin: { top: 8, right: 4, left: 0, bottom: 0 },
  };
  const axes = (
    <>
      <CartesianGrid stroke="#22272e" strokeDasharray="2 4" vertical={false} />
      <XAxis dataKey="date" tickFormatter={shortDate} stroke="#6b7581" fontSize={11} tickLine={false} axisLine={false} minTickGap={24} />
      <YAxis tickFormatter={(v) => human(v, 0)} stroke="#6b7581" fontSize={11} tickLine={false} axisLine={false} width={44} />
      <Tooltip content={<ChartTip keys={order} />} cursor={{ fill: 'rgba(255,255,255,0.03)', stroke: '#2e353e' }} />
    </>
  );
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {order.map((k) => {
            const off = hidden.has(k);
            return (
              <button key={k} onClick={() => toggle(k)}
                className={`flex items-center gap-2 rounded-md border px-2 py-1 text-xs transition ${off ? 'border-ink-700 text-ink-400 opacity-50' : 'border-ink-600 bg-ink-800/70 text-ink-100'}`}>
                <Dot color={off ? '#4a525c' : sourceColor(k, keys)} />
                {sourceLabel(k)}
                <span className="num text-ink-400">{human(totals[k])}</span>
              </button>
            );
          })}
        </div>
        <Segmented value={kind} onChange={setKind} options={[
          { value: 'bar', label: <BarChart3 className="h-3.5 w-3.5" /> },
          { value: 'area', label: <AreaIcon className="h-3.5 w-3.5" /> },
        ]} />
      </div>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {kind === 'bar' ? (
            <BarChart {...common} barCategoryGap="18%">
              {axes}
              {visible.map((k, i) => (
                <Bar key={k} dataKey={k} stackId="s" fill={sourceColor(k, keys)} radius={i === visible.length - 1 ? [3, 3, 0, 0] : 0} animationDuration={700} />
              ))}
            </BarChart>
          ) : (
            <AreaChart {...common}>
              <defs>
                {visible.map((k) => (
                  <linearGradient key={k} id={`g-${k.replace(/[^a-z0-9]/gi, '')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={sourceColor(k, keys)} stopOpacity={0.55} />
                    <stop offset="100%" stopColor={sourceColor(k, keys)} stopOpacity={0.05} />
                  </linearGradient>
                ))}
              </defs>
              {axes}
              {visible.map((k) => (
                <Area key={k} type="monotone" dataKey={k} stackId="s" stroke={sourceColor(k, keys)} strokeWidth={1.5}
                  fill={`url(#g-${k.replace(/[^a-z0-9]/gi, '')})`} animationDuration={700} />
              ))}
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ChartTip({ active, payload, label, keys }: any) {
  if (!active || !payload?.length) return null;
  const items = payload.filter((p: any) => p.value > 0).sort((a: any, b: any) => b.value - a.value);
  const total = items.reduce((a: number, p: any) => a + p.value, 0);
  return (
    <div className="min-w-[200px] rounded-lg border border-ink-600 bg-ink-900/95 p-3 text-xs shadow-2xl backdrop-blur">
      <div className="mb-2 flex justify-between gap-4">
        <span className="font-medium text-ink-100">{shortDate(label)}</span>
        <span className="num text-signal">{human(total, 2)}</span>
      </div>
      {items.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-2 text-ink-300"><Dot color={sourceColor(p.dataKey, keys)} />{sourceLabel(p.dataKey)}</span>
          <span className="num text-ink-100" title={full(p.value)}>{human(p.value, 2)}</span>
        </div>
      ))}
      {!items.length && <div className="text-ink-400">no usage</div>}
    </div>
  );
}
