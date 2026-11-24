import { useCallback, useEffect, useState } from 'react';
import { Activity, Boxes, CalendarDays, Database, Gauge, Layers, ListOrdered, PieChart as PieIcon, RefreshCw, TriangleAlert } from 'lucide-react';
import { api, type Daily, type Summary } from '../lib/api';
import { ago, human, shortDate } from '../lib/format';
import { Panel, Segmented, Skeleton } from './ui';
import { Hero } from './Hero';
import { KpiCards } from './KpiCards';
import { DailyChart } from './DailyChart';
import { ToolDonut } from './ToolDonut';
import { ModelBoard } from './ModelBoard';
import { CacheGauge } from './CacheGauge';
import { Heatmap } from './Heatmap';
import { SessionsTable } from './SessionsTable';

type Preset = 'today' | '7d' | '30d' | '90d' | 'all';
const TZ_H = 6;
const today = () => new Date(Date.now() + TZ_H * 3600e3).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

function rangeFor(p: Preset, first: string | null): { from: string; to: string } {
  const t = today();
  switch (p) {
    case 'today': return { from: t, to: t };
    case '7d': return { from: addDays(t, -6), to: t };
    case '30d': return { from: addDays(t, -29), to: t };
    case '90d': return { from: addDays(t, -89), to: t };
    case 'all': return { from: first ?? addDays(t, -364), to: t };
  }
}

export default function Dashboard() {
  const [preset, setPreset] = useState<Preset>(() => (localStorage.getItem('tt.preset') as Preset) || '30d');
  const [first, setFirst] = useState<string | null>(null);
  const [s, setS] = useState<Summary | null>(null);
  const [d, setD] = useState<Daily | null>(null);
  const [all, setAll] = useState<Daily | null>(null);
  const [hourly, setHourly] = useState<number[]>(new Array(24).fill(0));
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [, tick] = useState(0);

  const { from, to } = rangeFor(preset, first);

  const load = useCallback(async () => {
    try {
      const [sum, hr] = await Promise.all([api.summary(from, to), fetch('/api/hourly').then((r) => r.json())]);
      setS(sum);
      setHourly(hr.hours);
      if (sum.firstDate && sum.firstDate !== first) setFirst(sum.firstDate);
      // daily chart: at least 14 days of context even for "Today"
      const chartFrom = preset === 'today' ? addDays(to, -13) : from;
      // heatmap: from first recorded day (min ~26 weeks, max 52 weeks), grows with history
      const fd = sum.firstDate ?? to;
      const lo = addDays(to, -364), hi = addDays(to, -181);
      const heatFrom = fd < lo ? lo : fd > hi ? hi : fd;
      const [dd, aa] = await Promise.all([api.daily(chartFrom, to), api.daily(heatFrom, to)]);
      setD(dd);
      setAll(aa);
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [from, to, preset, first]);

  useEffect(() => { load(); }, [load, version]);
  useEffect(() => { localStorage.setItem('tt.preset', preset); }, [preset]);
  useEffect(() => { const i = setInterval(() => tick((x) => x + 1), 30_000); return () => clearInterval(i); }, []);
  // auto-poll the snapshot every 2 min (server refreshes itself every 5)
  useEffect(() => { const i = setInterval(() => setVersion((v) => v + 1), 120_000); return () => clearInterval(i); }, []);

  const doRefresh = async () => {
    setBusy(true);
    try { await api.refresh(); setVersion((v) => v + 1); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  const rt = s?.range_totals;
  const rangeLabel = from === to ? shortDate(from) : `${shortDate(from)} → ${shortDate(to)}`;

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-16 pt-6 sm:px-6 lg:px-10">
      {/* top bar */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg border border-ink-600 bg-ink-850">
            <svg viewBox="0 0 32 32" className="h-5 w-5"><path d="M5 23 L11 14 L17 18 L27 7" stroke="#d4ff3a" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /><circle cx="27" cy="7" r="2.5" fill="#d4ff3a" /></svg>
          </div>
          <div>
            <h1 className="font-display text-lg font-semibold leading-tight tracking-tight">Token Tracker</h1>
            <p className="text-xs text-ink-400">Hermes · ZCode · Antigravity — local, read-only</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Segmented<Preset> value={preset} onChange={setPreset} options={[
            { value: 'today', label: 'Today' }, { value: '7d', label: '7D' }, { value: '30d', label: '30D' }, { value: '90d', label: '90D' }, { value: 'all', label: 'All' },
          ]} />
          <div className="hidden items-center gap-2 text-xs text-ink-400 md:flex">
            <Database className="h-3.5 w-3.5" />
            <span>{s?.lastRefresh ? `synced ${ago(s.lastRefresh.at)}` : '—'}</span>
          </div>
          <button onClick={doRefresh} disabled={busy}
            className="group inline-flex items-center gap-2 rounded-lg border border-signal/40 bg-signal/10 px-3 py-1.5 text-xs font-medium text-signal transition hover:bg-signal hover:text-ink-950 disabled:opacity-60">
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : 'transition-transform group-hover:rotate-90'}`} />
            {busy ? 'Syncing…' : 'Refresh'}
          </button>
        </div>
      </header>

      {err && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose/40 bg-rose/10 px-3 py-2 text-sm text-rose">
          <TriangleAlert className="h-4 w-4" /> {err}
        </div>
      )}
      {s?.lastRefresh?.errors?.length ? (
        <div className="mb-4 rounded-lg border border-ember/40 bg-ember/10 px-3 py-2 text-xs text-ember">
          Collector warnings: {s.lastRefresh.errors.join(' · ')}
        </div>
      ) : null}

      {!s ? (
        <div className="space-y-4"><Skeleton className="h-[300px] w-full" /><div className="grid grid-cols-4 gap-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36" />)}</div></div>
      ) : (
        <div className="space-y-4">
          <Hero s={s} hourly={hourly} />
          <KpiCards s={s} all={all} />

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-4">
            <span className="label">Range</span>
            <span className="num whitespace-nowrap text-sm text-ink-100">{rangeLabel}</span>
            <span className="hidden h-px flex-1 bg-gradient-to-r from-ink-700 to-transparent sm:block" />
            {rt && <span className="num w-full text-sm text-ink-300 sm:w-auto"><span className="text-signal">{human(rt.total, 2)}</span> tokens · {human(rt.calls)} calls · {rt.sessions} sessions</span>}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Panel title="Daily tokens by source" icon={<Activity />} className="xl:col-span-2" delay={100}
              right={preset === 'today' ? <span className="text-[11px] text-ink-400">showing last 14 days</span> : null}>
              {d ? <DailyChart key={d.from + d.to + version} d={d} /> : <Skeleton className="h-[340px]" />}
            </Panel>
            <Panel title="Share by tool" icon={<PieIcon />} delay={160}>
              <ToolDonut s={s} />
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Panel title="Model leaderboard" icon={<ListOrdered />} className="lg:col-span-2" delay={200}
              right={<span className="text-[11px] text-ink-400">{s.byModel.length} models</span>}>
              <ModelBoard s={s} />
            </Panel>
            <Panel title="Cache efficiency" icon={<Gauge />} delay={240}>
              <CacheGauge t={s.range_totals} byTool={s.byTool} />
            </Panel>
          </div>

          <Panel title="Activity calendar" icon={<CalendarDays />} delay={280}
            right={<span className="text-[11px] text-ink-400">all sources · Asia/Dhaka days</span>}>
            {all ? <Heatmap d={all} /> : <Skeleton className="h-[140px]" />}
          </Panel>

          <Panel title="Top sessions" icon={<Layers />} delay={320}>
            <SessionsTable from={from} to={to} version={version} />
          </Panel>

          <footer className="flex flex-wrap items-center justify-between gap-3 pt-6 text-[11px] text-ink-400">
            <span className="flex items-center gap-2"><Boxes className="h-3.5 w-3.5" />
              {s.lastRefresh ? `${s.lastRefresh.totalRows.toLocaleString()} records in local snapshot · last sync took ${s.lastRefresh.ms}ms` : ''}
            </span>
            <span>Total = fresh input + output + cache read + cache write. Hermes rows dated by last activity.</span>
          </footer>
        </div>
      )}
    </div>
  );
}
