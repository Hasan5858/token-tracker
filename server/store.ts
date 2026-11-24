import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR, type UsageRecord } from './lib.ts';
import { collectHermes } from './collectors/hermes.ts';
import { collectZcode } from './collectors/zcode.ts';
import { collectAntigravity, antigravityTitles } from './collectors/antigravity.ts';

/** Our own snapshot DB (the ONLY database we ever write to). */
export const SNAPSHOT_PATH = process.env.TT_DB ?? join(DATA_DIR, 'usage.db');

let _db: DatabaseSync | null = null;
export function store(): DatabaseSync {
  if (_db) return _db;
  mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(SNAPSHOT_PATH);
  db.exec(`
    pragma journal_mode = wal;
    create table if not exists usage (
      id text primary key, tool text not null, profile text not null, model text not null, provider text not null,
      session_id text not null, session_title text not null default '', ts real not null, date text not null,
      input integer not null default 0, output integer not null default 0, cache_read integer not null default 0,
      cache_write integer not null default 0, reasoning integer not null default 0, calls integer not null default 0,
      cost_usd real, ingested_at real not null
    );
    create index if not exists usage_date on usage(date);
    create index if not exists usage_tool_date on usage(tool, date);
    create index if not exists usage_session on usage(session_id);
    create table if not exists file_stamps (path text primary key, mtime_ms real not null, size integer not null);
    create table if not exists meta (key text primary key, value text not null);
  `);
  _db = db;
  return db;
}

export interface RefreshResult {
  at: number; ms: number; upserted: number; totalRows: number;
  bySource: Record<string, number>; errors: string[]; antigravity: { scanned: number; skipped: number };
}

let running: Promise<RefreshResult> | null = null;
export function refresh(): Promise<RefreshResult> {
  if (!running) running = Promise.resolve().then(doRefresh).finally(() => { running = null; });
  return running;
}

function doRefresh(): RefreshResult {
  const t0 = performance.now();
  const db = store();
  const stampQ = db.prepare('select mtime_ms, size from file_stamps where path = ?');
  const h = collectHermes();
  const z = collectZcode();
  const a = collectAntigravity((s) => {
    const row = stampQ.get(s.path) as any;
    return !!row && row.mtime_ms === s.mtimeMs && row.size === s.size;
  });
  const all: UsageRecord[] = [...h.records, ...z.records, ...a.records];
  const up = db.prepare(`insert into usage (id, tool, profile, model, provider, session_id, session_title, ts, date,
      input, output, cache_read, cache_write, reasoning, calls, cost_usd, ingested_at)
    values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    on conflict(id) do update set model=excluded.model, provider=excluded.provider,
      session_title=case when excluded.session_title != '' then excluded.session_title else usage.session_title end,
      ts=excluded.ts, date=excluded.date, input=excluded.input, output=excluded.output, cache_read=excluded.cache_read,
      cache_write=excluded.cache_write, reasoning=excluded.reasoning, calls=excluded.calls, cost_usd=excluded.cost_usd,
      ingested_at=excluded.ingested_at`);
  const now = Date.now() / 1000;
  const bySource: Record<string, number> = {};
  db.exec('begin');
  try {
    for (const r of all) {
      up.run(r.id, r.tool, r.profile, r.model, r.provider, r.sessionId, r.sessionTitle, r.ts, r.date, r.input, r.output,
        r.cacheRead, r.cacheWrite, r.reasoning, r.calls, r.costUsd, now);
      const k = r.tool === 'hermes' ? `hermes:${r.profile}` : r.tool;
      bySource[k] = (bySource[k] ?? 0) + 1;
    }
    const st = db.prepare('insert into file_stamps (path, mtime_ms, size) values (?,?,?) on conflict(path) do update set mtime_ms=excluded.mtime_ms, size=excluded.size');
    for (const s of a.stamps) st.run(s.path, s.mtimeMs, s.size);
    // Antigravity titles may appear after the transcript was ingested.
    const tq = db.prepare("update usage set session_title = ? where tool='antigravity' and session_id = ? and session_title != ?");
    for (const [id, t] of antigravityTitles()) tq.run(t, id, t);
    db.prepare("insert into meta (key, value) values ('last_refresh', ?) on conflict(key) do update set value=excluded.value").run(String(now));
    db.exec('commit');
  } catch (e) {
    db.exec('rollback');
    throw e;
  }
  const totalRows = (db.prepare('select count(*) n from usage').get() as any).n;
  const res: RefreshResult = {
    at: now, ms: Math.round(performance.now() - t0), upserted: all.length, totalRows, bySource,
    errors: [...h.errors, ...z.errors, ...a.errors], antigravity: { scanned: a.scanned, skipped: a.skipped },
  };
  db.prepare("insert into meta (key, value) values ('last_refresh_result', ?) on conflict(key) do update set value=excluded.value").run(JSON.stringify(res));
  return res;
}

export function lastRefresh(): RefreshResult | null {
  const r = store().prepare("select value from meta where key='last_refresh_result'").get() as any;
  return r ? JSON.parse(r.value) : null;
}
