import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { HOME, hasTable, localDate, num, openReadOnly, type UsageRecord } from '../lib.ts';

/** Discover Hermes profiles: ~/.hermes/state.db = 'default', plus ~/.hermes/profiles/<name>/state.db */
export function hermesProfiles(): { profile: string; path: string }[] {
  const base = process.env.TT_HERMES_HOME ?? process.env.HERMES_HOME ?? join(HOME, '.hermes');
  const out: { profile: string; path: string }[] = [];
  if (existsSync(join(base, 'state.db'))) out.push({ profile: 'default', path: join(base, 'state.db') });
  const pdir = join(base, 'profiles');
  if (existsSync(pdir)) {
    for (const name of readdirSync(pdir).sort()) {
      const p = join(pdir, name, 'state.db');
      if (existsSync(p)) out.push({ profile: name, path: p });
    }
  }
  return out;
}

function providerLabel(bp: string, url: string): string {
  if (url) {
    try {
      const u = new URL(url);
      return u.hostname === 'localhost' || u.hostname === '127.0.0.1' ? `local:${u.port}` : u.hostname;
    } catch {}
  }
  return bp || 'unknown';
}

const cost = (actual: unknown, est: unknown): number | null => {
  const a = num(actual), e = num(est);
  return a > 0 ? a : e > 0 ? e : null;
};

/**
 * Hermes stores canonical usage where input_tokens EXCLUDES cache reads/writes
 * (verified: many rows have cache_read >> input). So input = fresh input.
 * Per-model rows come from session_model_usage, dated by last_seen.
 * Sessions with no session_model_usage rows fall back to the sessions table.
 */
export function collectHermes(): { records: UsageRecord[]; errors: string[] } {
  const records: UsageRecord[] = [];
  const errors: string[] = [];
  for (const { profile, path } of hermesProfiles()) {
    let h;
    try { h = openReadOnly(path); } catch (e) { errors.push(`hermes:${profile}: ${(e as Error).message}`); continue; }
    const { db } = h;
    try {
      const titles = new Map<string, string>();
      for (const r of db.prepare('select id, title from sessions').all() as any[]) titles.set(r.id, r.title ?? '');
      const covered = new Set<string>();
      if (hasTable(db, 'session_model_usage')) {
        const rows = db.prepare(`select session_id, model, billing_provider, coalesce(billing_base_url,'') url,
          coalesce(task,'') task, coalesce(billing_mode,'') mode, api_call_count, input_tokens, output_tokens,
          cache_read_tokens, cache_write_tokens, reasoning_tokens, estimated_cost_usd, actual_cost_usd,
          first_seen, last_seen from session_model_usage`).all() as any[];
        for (const r of rows) {
          covered.add(r.session_id);
          const ts = num(r.last_seen) || num(r.first_seen);
          if (!ts) continue;
          const input = num(r.input_tokens), output = num(r.output_tokens), cr = num(r.cache_read_tokens), cw = num(r.cache_write_tokens);
          if (input + output + cr + cw === 0) continue;
          records.push({
            id: `hermes|${profile}|${r.session_id}|${r.model}|${r.billing_provider}|${r.url}|${r.mode}|${r.task}`,
            tool: 'hermes', profile, model: r.model || 'unknown',
            provider: providerLabel(r.billing_provider ?? '', r.url),
            sessionId: r.session_id,
            sessionTitle: (titles.get(r.session_id) || '') + (r.task ? ` · ${r.task}` : ''),
            ts, date: localDate(ts), input, output, cacheRead: cr, cacheWrite: cw,
            reasoning: num(r.reasoning_tokens), calls: num(r.api_call_count) || 0,
            costUsd: cost(r.actual_cost_usd, r.estimated_cost_usd),
          });
        }
      }
      const srows = db.prepare(`select id, title, model, billing_provider, coalesce(billing_base_url,'') url, started_at, ended_at,
        input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, reasoning_tokens, api_call_count,
        estimated_cost_usd, actual_cost_usd from sessions`).all() as any[];
      for (const r of srows) {
        if (covered.has(r.id)) continue;
        const input = num(r.input_tokens), output = num(r.output_tokens), cr = num(r.cache_read_tokens), cw = num(r.cache_write_tokens);
        if (input + output + cr + cw === 0) continue;
        const ts = num(r.ended_at) || num(r.started_at);
        if (!ts) continue;
        records.push({
          id: `hermes|${profile}|${r.id}|session`, tool: 'hermes', profile, model: r.model || 'unknown',
          provider: providerLabel(r.billing_provider ?? '', r.url), sessionId: r.id, sessionTitle: r.title ?? '',
          ts, date: localDate(ts), input, output, cacheRead: cr, cacheWrite: cw, reasoning: num(r.reasoning_tokens),
          calls: num(r.api_call_count), costUsd: cost(r.actual_cost_usd, r.estimated_cost_usd),
        });
      }
    } catch (e) {
      errors.push(`hermes:${profile}: ${(e as Error).message}`);
    } finally {
      h.close();
    }
  }
  return { records, errors };
}
