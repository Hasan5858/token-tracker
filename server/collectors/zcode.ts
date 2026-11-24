import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { HOME, hasTable, localDate, num, openReadOnly, type UsageRecord } from '../lib.ts';

export const ZCODE_DB = join(HOME, '.zcode', 'cli', 'db', 'db.sqlite');

/**
 * ZCode model_usage: one row per request. started_at is in MILLISECONDS.
 * input_tokens is INCLUSIVE of cache_read_input_tokens (verified: raw_usage_json
 * inputTokens == input_tokens and cacheReadTokens <= input on every row, total = input+output).
 * So fresh input = input_tokens - cache_read - cache_creation (clamped at 0).
 */
export function collectZcode(): { records: UsageRecord[]; errors: string[] } {
  const records: UsageRecord[] = [];
  if (!existsSync(ZCODE_DB)) return { records, errors: [] };
  let h;
  try { h = openReadOnly(ZCODE_DB); } catch (e) { return { records, errors: [`zcode: ${(e as Error).message}`] }; }
  try {
    const { db } = h;
    const titles = new Map<string, string>();
    if (hasTable(db, 'session')) for (const r of db.prepare('select id, title from session').all() as any[]) titles.set(r.id, r.title ?? '');
    const rows = db.prepare(`select id, session_id, provider_id, model_id, agent, started_at, input_tokens, output_tokens,
      reasoning_tokens, cache_creation_input_tokens cw, cache_read_input_tokens cr from model_usage`).all() as any[];
    for (const r of rows) {
      const rawIn = num(r.input_tokens), cr = num(r.cr), cw = num(r.cw), output = num(r.output_tokens);
      if (rawIn + output + cr + cw === 0) continue; // failed/rate-limited requests
      const ts = num(r.started_at) / 1000;
      records.push({
        id: `zcode|${r.id}`, tool: 'zcode', profile: 'zcode', model: r.model_id || 'unknown',
        provider: String(r.provider_id || 'unknown').replace(/^account:/, ''),
        sessionId: r.session_id, sessionTitle: titles.get(r.session_id) ?? '',
        ts, date: localDate(ts), input: Math.max(0, rawIn - cr - cw), output, cacheRead: cr, cacheWrite: cw,
        reasoning: num(r.reasoning_tokens), calls: 1, costUsd: null,
      });
    }
    return { records, errors: [] };
  } catch (e) {
    return { records, errors: [`zcode: ${(e as Error).message}`] };
  } finally {
    h.close();
  }
}
