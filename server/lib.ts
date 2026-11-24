import { DatabaseSync } from 'node:sqlite';
import { copyFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HOME = homedir();
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = join(ROOT, 'data');

/** Local timezone offset in hours. Default Asia/Dhaka (UTC+6, no DST). */
export const TZ_OFFSET_H = Number(process.env.TT_TZ_OFFSET ?? -new Date().getTimezoneOffset() / 60);

export type Tool = 'hermes' | 'zcode' | 'antigravity';

/** Normalized usage record. `input` is ALWAYS fresh (non-cached) input. */
export interface UsageRecord {
  id: string;
  tool: Tool;
  profile: string;
  model: string;
  provider: string;
  sessionId: string;
  sessionTitle: string;
  ts: number; // unix seconds
  date: string; // YYYY-MM-DD local (Dhaka)
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  reasoning: number;
  calls: number;
  costUsd: number | null;
}

export function localDate(tsSec: number): string {
  return new Date((tsSec + TZ_OFFSET_H * 3600) * 1000).toISOString().slice(0, 10);
}

export function todayLocal(): string {
  return localDate(Date.now() / 1000);
}

export function addDays(date: string, n: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Open a foreign SQLite DB strictly read-only. If that fails (WAL/shm lock
 * quirks), copy db + -wal + -shm into a temp dir and read the copy.
 * Returns the db and a cleanup fn.
 */
export function openReadOnly(path: string): { db: DatabaseSync; close: () => void } {
  try {
    const db = new DatabaseSync(path, { readOnly: true });
    db.prepare('select 1 from sqlite_master limit 1').get();
    return { db, close: () => db.close() };
  } catch {
    const dir = mkdtempSync(join(tmpdir(), 'tt-'));
    const target = join(dir, 'copy.db');
    copyFileSync(path, target);
    for (const ext of ['-wal', '-shm']) {
      if (existsSync(path + ext)) copyFileSync(path + ext, target + ext);
    }
    const db = new DatabaseSync(target, { readOnly: true });
    return {
      db,
      close: () => {
        try { db.close(); } catch {}
        rmSync(dir, { recursive: true, force: true });
      },
    };
  }
}

export function hasTable(db: DatabaseSync, name: string): boolean {
  return !!db.prepare("select 1 from sqlite_master where type='table' and name=?").get(name);
}
