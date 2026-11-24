import { Hono } from 'hono';
import { daily, hourly, parseRange, sessions, summary } from './queries.ts';
import { lastRefresh, refresh } from './store.ts';
import { TZ_OFFSET_H, todayLocal } from './lib.ts';

export const api = new Hono();

api.get('/health', (c) => c.json({ ok: true }));
api.get('/summary', (c) => c.json({ ...summary(parseRange(c.req.query('from'), c.req.query('to'))), lastRefresh: lastRefresh(), tzOffsetHours: TZ_OFFSET_H }));
api.get('/daily', (c) => c.json(daily(parseRange(c.req.query('from'), c.req.query('to')))));
api.get('/sessions', (c) =>
  c.json(sessions(parseRange(c.req.query('from'), c.req.query('to')), c.req.query('tool'), Number(c.req.query('limit') ?? 50))));
api.get('/refresh', (c) => c.json(lastRefresh()));
api.post('/refresh', async (c) => {
  try { return c.json(await refresh()); } catch (e) { return c.json({ error: (e as Error).message }, 500); }
});
api.get('/hourly', (c) => {
  const d = c.req.query('date');
  return c.json(hourly(d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : todayLocal()));
});
