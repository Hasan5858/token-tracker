import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';
import { useId } from 'react';

export function Sparkline({ data, color, height = 40 }: { data: number[]; color: string; height?: number }) {
  const id = useId().replace(/:/g, '');
  const rows = data.map((v, i) => ({ i, v }));
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`sp${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={[0, 'dataMax']} />
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#sp${id})`} isAnimationActive animationDuration={900} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
