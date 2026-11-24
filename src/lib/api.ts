export type Totals = {
  input: number; output: number; cacheRead: number; cacheWrite: number; reasoning: number;
  calls: number; total: number; cost: number | null; sessions: number;
};
export type Summary = {
  range: { from: string; to: string; days: number };
  today: Totals & { date: string };
  yesterday: Totals & { date: string };
  last7: Totals; last30: Totals; allTime: Totals; range_totals: Totals;
  prev_range_totals: Totals & { from: string; to: string };
  byTool: (Totals & { tool: string })[];
  byProfile: (Totals & { key: string; tool: string; profile: string })[];
  byModel: (Totals & { model: string; tool: string; providers: string })[];
  firstDate: string | null;
  lastRefresh: { at: number; ms: number; upserted: number; totalRows: number; errors: string[] } | null;
};
export type Daily = {
  from: string; to: string; keys: string[];
  days: { date: string; total: number; input: number; output: number; cacheRead: number; cacheWrite: number; calls: number; sources: Record<string, number> }[];
};
export type SessionRow = Totals & {
  tool: string; profile: string; sessionId: string; title: string | null; models: string; firstTs: number; lastTs: number;
};

async function get<T>(path: string): Promise<T> {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}
const q = (from: string, to: string) => `from=${from}&to=${to}`;
export const api = {
  summary: (from: string, to: string) => get<Summary>(`/api/summary?${q(from, to)}`),
  daily: (from: string, to: string) => get<Daily>(`/api/daily?${q(from, to)}`),
  sessions: (from: string, to: string, tool = '') => get<SessionRow[]>(`/api/sessions?${q(from, to)}&limit=40${tool ? `&tool=${tool}` : ''}`),
  refresh: async () => {
    const r = await fetch('/api/refresh', { method: 'POST' });
    if (!r.ok) throw new Error('refresh failed');
    return r.json();
  },
};
