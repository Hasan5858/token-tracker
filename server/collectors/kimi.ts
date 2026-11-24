import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { HOME, localDate, num, type UsageRecord } from '../lib.ts';

const KIMI = process.env.TT_KIMI_HOME ?? join(HOME, '.kimi-code');
const SESSIONS = join(KIMI, 'sessions');

/**
 * Kimi Code (VS Code extension / CLI): ~/.kimi-code/sessions/<workdir>/<session>/agents/<agent>/wire.jsonl.
 * Lines {type:'usage.record', model, usage:{inputOther, output, inputCacheRead, inputCacheCreation}, time(ms)}
 * — one per turn. inputOther is fresh input (excludes cache). Title from <session>/state.json.
 */
export function collectKimi(): { records: UsageRecord[]; errors: string[] } {
  const records: UsageRecord[] = [];
  const errors: string[] = [];
  if (!existsSync(SESSIONS)) return { records, errors };
  for (const wd of readdirSync(SESSIONS, { withFileTypes: true })) {
    if (!wd.isDirectory() || wd.name.startsWith('.')) continue;
    for (const s of readdirSync(join(SESSIONS, wd.name), { withFileTypes: true })) {
      if (!s.isDirectory()) continue;
      const sdir = join(SESSIONS, wd.name, s.name);
      let title = '';
      try {
        const st = JSON.parse(readFileSync(join(sdir, 'state.json'), 'utf8'));
        title = String(st.title ?? '').slice(0, 140) || (st.cwd ? basename(st.cwd) : '');
      } catch {}
      const agentsDir = join(sdir, 'agents');
      if (!existsSync(agentsDir)) continue;
      for (const a of readdirSync(agentsDir, { withFileTypes: true })) {
        const f = join(agentsDir, a.name, 'wire.jsonl');
        if (!a.isDirectory() || !existsSync(f)) continue;
        let text: string;
        try { text = readFileSync(f, 'utf8'); } catch (e) { errors.push(`kimi: ${(e as Error).message}`); continue; }
        let n = 0;
        for (const line of text.split('\n')) {
          if (!line.includes('"usage.record"')) continue;
          let d: any;
          try { d = JSON.parse(line); } catch { continue; }
          if (d.type !== 'usage.record' || !d.usage) continue;
          n++;
          const u = d.usage;
          const input = num(u.inputOther), output = num(u.output), cr = num(u.inputCacheRead), cw = num(u.inputCacheCreation);
          if (input + output + cr + cw === 0) continue;
          const ts = num(d.time) / 1000;
          records.push({
            id: `kimi|${s.name}|${a.name}|${n}|${d.time}`, tool: 'kimi', profile: 'kimi',
            model: String(d.model ?? 'unknown').replace(/^kimi-code\//, ''), provider: 'moonshot',
            sessionId: s.name, sessionTitle: title, ts, date: localDate(ts), input, output, cacheRead: cr, cacheWrite: cw,
            reasoning: 0, calls: 1, costUsd: null,
          });
        }
      }
    }
  }
  return { records, errors };
}
