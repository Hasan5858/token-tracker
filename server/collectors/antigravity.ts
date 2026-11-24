import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { HOME, hasTable, localDate, num, openReadOnly, type UsageRecord } from '../lib.ts';

const AG = join(HOME, '.gemini', 'antigravity');
export const AG_BRAIN = join(AG, 'brain');
const AG_SUMMARIES = join(AG, 'conversation_summaries.db');

function loadTitles(): Map<string, string> {
  const m = new Map<string, string>();
  if (!existsSync(AG_SUMMARIES)) return m;
  const h = openReadOnly(AG_SUMMARIES);
  try {
    if (hasTable(h.db, 'conversation_summaries')) {
      for (const r of h.db.prepare('select conversation_id id, title, preview from conversation_summaries').all() as any[]) {
        const t = (r.title || r.preview || '').toString().trim();
        if (t) m.set(r.id, t.length > 140 ? t.slice(0, 137) + '…' : t);
      }
    }
  } finally { h.close(); }
  return m;
}

export interface FileStamp { path: string; mtimeMs: number; size: number }

/**
 * Antigravity transcripts: PLANNER_RESPONSE lines carry created_at (ISO UTC),
 * input_tokens, output_tokens, cache_read_tokens. input EXCLUDES cache reads
 * (verified: e.g. input 2055 + cache_read 16252 following a 16481-input step).
 * No model name is logged -> 'Antigravity (unknown)'.
 * `isUnchanged` lets the snapshot layer skip files already ingested.
 */
export function collectAntigravity(isUnchanged: (s: FileStamp) => boolean = () => false): {
  records: UsageRecord[]; errors: string[]; stamps: FileStamp[]; scanned: number; skipped: number;
} {
  const records: UsageRecord[] = [];
  const errors: string[] = [];
  const stamps: FileStamp[] = [];
  let scanned = 0, skipped = 0;
  if (!existsSync(AG_BRAIN)) return { records, errors, stamps, scanned, skipped };
  let titles = new Map<string, string>();
  try { titles = loadTitles(); } catch (e) { errors.push(`antigravity titles: ${(e as Error).message}`); }
  for (const conv of readdirSync(AG_BRAIN)) {
    const file = join(AG_BRAIN, conv, '.system_generated', 'logs', 'transcript.jsonl');
    let st;
    try { st = statSync(file); } catch { continue; }
    const stamp = { path: file, mtimeMs: st.mtimeMs, size: st.size };
    stamps.push(stamp);
    if (isUnchanged(stamp)) { skipped++; continue; }
    scanned++;
    let text: string;
    try { text = readFileSync(file, 'utf8'); } catch (e) { errors.push(`antigravity ${conv}: ${(e as Error).message}`); continue; }
    let lineNo = 0;
    const seen = new Map<string, number>();
    for (const line of text.split('\n')) {
      lineNo++;
      if (!line.includes('PLANNER_RESPONSE') || !line.includes('_tokens')) continue;
      let r: any;
      try { r = JSON.parse(line); } catch { continue; }
      if (r.type !== 'PLANNER_RESPONSE') continue;
      const input = num(r.input_tokens), output = num(r.output_tokens), cr = num(r.cache_read_tokens);
      if (input + output + cr === 0) continue;
      const ts = Date.parse(r.created_at) / 1000;
      if (!Number.isFinite(ts)) continue;
      // step_index can repeat inside one transcript (agent restarts) -> key on step+timestamp+occurrence.
      const base = `antigravity|${conv}|${r.step_index ?? 'l' + lineNo}|${r.created_at}`;
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      records.push({
        id: n > 1 ? `${base}#${n}` : base, tool: 'antigravity', profile: 'antigravity',
        model: 'Antigravity (unknown)', provider: 'google', sessionId: conv, sessionTitle: titles.get(conv) ?? '',
        ts, date: localDate(ts), input, output, cacheRead: cr, cacheWrite: 0, reasoning: 0, calls: 1, costUsd: null,
      });
    }
  }
  return { records, errors, stamps, scanned, skipped };
}

/** Refresh titles for sessions already in the snapshot (titles are generated later). */
export function antigravityTitles(): Map<string, string> {
  try { return loadTitles(); } catch { return new Map(); }
}
