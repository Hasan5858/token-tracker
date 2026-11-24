import { store } from './store.ts';
import { TZ_OFFSET_H, addDays, todayLocal } from './lib.ts';

export interface Range { from: string; to: string }

const ISO = /^\d{4}-\d{2}-\d{2}$/;
export function parseRange(from?: string, to?: string): Range {
  const today = todayLocal();
  const t = to && ISO.test(to) ? to : today;
  let f = from && ISO.test(from) ? from : addDays(t, -29);
  if (from === 'all') f = firstDate() ?? f;
  return f <= t ? { from: f, to: t } : { from: t, to: f };
}

export function firstDate(): string | null {
  return ((store().prepare('select min(date) d from usage').get() as any)?.d) ?? null;
}

const SUMS = `sum(input) input, sum(output) output, sum(cache_read) cacheRead, sum(cache_write) cacheWrite,
  sum(reasoning) reasoning, sum(calls) calls, sum(input + output + cache_read + cache_write) total,
  sum(cost_usd) cost, count(distinct session_id) sessions`;

export const sourceKey = (tool: string, profile: string) => (tool === 'hermes' ? `hermes:${profile}` : tool);

function totals(from: string, to: string) {
  const r = store().prepare(`select ${SUMS} from usage where date between ? and ?`).get(from, to) as any;
  for (const k of Object.keys(r)) if (r[k] == null && k !== 'cost') r[k] = 0;
  return r;
}

export function summary({ from, to }: Range) {
  const db = store();
  const today = todayLocal();
  const yesterday = addDays(today, -1);
  const rangeDays = Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1;
  const prevTo = addDays(from, -1), prevFrom = addDays(from, -rangeDays);
  const group = (col: string) =>
    db.prepare(`select ${col}, ${SUMS} from usage where date between ? and ? group by ${col} order by total desc`).all(from, to);
  const bySource = (db.prepare(`select tool, profile, ${SUMS} from usage where date between ? and ? group by tool, profile order by total desc`)
    .all(from, to) as any[]).map((r) => ({ key: sourceKey(r.tool, r.profile), ...r }));
  const byModel = db.prepare(`select model, tool, group_concat(distinct provider) providers, ${SUMS} from usage
    where date between ? and ? group by model, tool order by total desc limit 25`).all(from, to);
  return {
    range: { from, to, days: rangeDays },
    today: { date: today, ...totals(today, today) },
    yesterday: { date: yesterday, ...totals(yesterday, yesterday) },
    last7: totals(addDays(today, -6), today),
    last30: totals(addDays(today, -29), today),
    allTime: totals('0000-00-00', '9999-99-99'),
    range_totals: totals(from, to),
    prev_range_totals: { from: prevFrom, to: prevTo, ...totals(prevFrom, prevTo) },
    byTool: group('tool'),
    byProfile: bySource,
    byModel,
    firstDate: firstDate(),
  };
}

export function daily({ from, to }: Range) {
  const rows = store().prepare(`select date, tool, profile, sum(input) input, sum(output) output, sum(cache_read) cacheRead,
    sum(cache_write) cacheWrite, sum(input + output + cache_read + cache_write) total, sum(calls) calls
    from usage where date between ? and ? group by date, tool, profile order by date`).all(from, to) as any[];
  const keys = new Set<string>();
  const byDate = new Map<string, any>();
  for (let d = from; d <= to; d = addDays(d, 1)) byDate.set(d, { date: d, total: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, calls: 0, sources: {} });
  for (const r of rows) {
    const k = sourceKey(r.tool, r.profile);
    keys.add(k);
    const day = byDate.get(r.date);
    if (!day) continue;
    day.sources[k] = (day.sources[k] ?? 0) + r.total;
    for (const f of ['total', 'input', 'output', 'cacheRead', 'cacheWrite', 'calls']) day[f] += r[f];
  }
  return { from, to, keys: [...keys].sort(), days: [...byDate.values()] };
}

export function sessions({ from, to }: Range, tool?: string, limit = 50) {
  const params: any[] = [from, to];
  let where = 'date between ? and ?';
  if (tool && ['hermes', 'zcode', 'antigravity'].includes(tool)) { where += ' and tool = ?'; params.push(tool); }
  params.push(Math.min(Math.max(limit, 1), 500));
  return store().prepare(`select tool, profile, session_id sessionId, max(session_title) title,
    group_concat(distinct model) models, min(ts) firstTs, max(ts) lastTs, ${SUMS}
    from usage where ${where} group by tool, profile, session_id order by total desc limit ?`).all(...params);
}

/** Tokens per local hour for one day (Antigravity/ZCode are per-request; Hermes is per-session-model, dated by last_seen). */
export function hourly(date: string) {
  const off = TZ_OFFSET_H * 3600;
  const rows = store().prepare(`select cast(((ts + ?) % 86400) / 3600 as integer) h, sum(input + output + cache_read + cache_write) total
    from usage where date = ? group by h`).all(off, date) as any[];
  const out = new Array(24).fill(0);
  for (const r of rows) out[r.h] = r.total;
  return { date, hours: out };
}
