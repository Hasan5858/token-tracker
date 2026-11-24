import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { HOME, localDate, num, type UsageRecord } from '../lib.ts';

const CLAUDE = process.env.TT_CLAUDE_HOME ?? process.env.CLAUDE_CONFIG_DIR ?? join(HOME, '.claude');
const PROJECTS = join(CLAUDE, 'projects');

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.jsonl')) out.push(p);
  }
  return out;
}

/**
 * Claude Code transcripts: ~/.claude/projects/<project>/<session>.jsonl (+ subagent jsonl files).
 * One API response is split over several lines (one per content block) sharing message.id+requestId
 * with identical usage, so dedupe on that key. input_tokens EXCLUDES cache (Anthropic semantics).
 */
export function collectClaude(): { records: UsageRecord[]; errors: string[] } {
  const records: UsageRecord[] = [];
  const errors: string[] = [];
  if (!existsSync(PROJECTS)) return { records, errors };
  const seen = new Set<string>();
  const titles = new Map<string, string>();
  const pending: { rec: UsageRecord; sid: string }[] = [];
  for (const file of walk(PROJECTS)) {
    let text: string;
    try { if (statSync(file).size === 0) continue; text = readFileSync(file, 'utf8'); } catch (e) { errors.push(`claude: ${(e as Error).message}`); continue; }
    for (const line of text.split('\n')) {
      if (!line) continue;
      let d: any;
      try { d = JSON.parse(line); } catch { continue; }
      if (d.type === 'summary' && d.leafUuid && d.summary) { titles.set('leaf:' + d.leafUuid, d.summary); continue; }
      if (d.type === 'ai-title' || d.type === 'custom-title') { const t = d.title ?? d.customTitle ?? d.aiTitle; if (t && d.sessionId) titles.set(d.sessionId, t); continue; }
      const m = d.message;
      if (d.type !== 'assistant' || !m?.usage || m.model === '<synthetic>') continue;
      const key = `${m.id ?? d.uuid}|${d.requestId ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const u = m.usage;
      const input = num(u.input_tokens), output = num(u.output_tokens);
      const cr = num(u.cache_read_input_tokens), cw = num(u.cache_creation_input_tokens);
      if (input + output + cr + cw === 0) continue;
      const ts = Date.parse(d.timestamp) / 1000;
      if (!Number.isFinite(ts)) continue;
      const sid = d.sessionId ?? basename(file, '.jsonl');
      if (!titles.has(sid) && d.cwd) titles.set('cwd:' + sid, basename(d.cwd));
      const rec: UsageRecord = {
        id: `claude|${key}`, tool: 'claude', profile: 'claude', model: m.model || 'unknown', provider: 'anthropic',
        sessionId: sid, sessionTitle: '', ts, date: localDate(ts), input, output, cacheRead: cr, cacheWrite: cw,
        reasoning: 0, calls: 1, costUsd: null,
      };
      pending.push({ rec, sid });
    }
  }
  for (const { rec, sid } of pending) rec.sessionTitle = titles.get(sid) ?? titles.get('cwd:' + sid) ?? '';
  records.push(...pending.map((p) => p.rec));
  return { records, errors };
}
