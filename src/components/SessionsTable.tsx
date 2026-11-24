import { useEffect, useState } from 'react';
import { api, type SessionRow } from '../lib/api';
import { dhakaDateTime, full, human, pct } from '../lib/format';
import { TOOL_COLOR, TOOL_LABEL } from '../lib/colors';
import { Segmented, Skeleton } from './ui';

type ToolFilter = '' | 'hermes' | 'zcode' | 'antigravity';

export function SessionsTable({ from, to, version }: { from: string; to: string; version: number }) {
  const [tool, setTool] = useState<ToolFilter>('');
  const [rows, setRows] = useState<SessionRow[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    let live = true;
    setRows(null);
    api.sessions(from, to, tool).then((r) => live && setRows(r)).catch(() => live && setRows([]));
    return () => { live = false; };
  }, [from, to, tool, version]);
  const max = Math.max(1, ...(rows ?? []).map((r) => r.total));
  const list = showAll ? rows ?? [] : (rows ?? []).slice(0, 12);
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Segmented value={tool} onChange={setTool} options={[
          { value: '', label: 'All' }, { value: 'hermes', label: 'Hermes' }, { value: 'zcode', label: 'ZCode' }, { value: 'antigravity', label: 'Antigravity' },
        ]} />
      </div>
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-ink-700 text-left label">
              <th className="py-2 pr-3 font-semibold">Session</th>
              <th className="py-2 pr-3 font-semibold">Source</th>
              <th className="py-2 pr-3 font-semibold">Last active</th>
              <th className="py-2 pr-3 text-right font-semibold">Calls</th>
              <th className="py-2 pr-3 text-right font-semibold">Fresh in</th>
              <th className="py-2 pr-3 text-right font-semibold">Out</th>
              <th className="py-2 pr-3 text-right font-semibold">Cache</th>
              <th className="w-[180px] py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {!rows && Array.from({ length: 6 }, (_, i) => (
              <tr key={i}><td colSpan={8} className="py-2"><Skeleton className="h-6 w-full" /></td></tr>
            ))}
            {list.map((r) => {
              const c = TOOL_COLOR[r.tool];
              const prompt = r.input + r.cacheRead + r.cacheWrite;
              return (
                <tr key={r.tool + r.profile + r.sessionId} className="border-b border-ink-800/80 transition hover:bg-ink-800/40">
                  <td className="max-w-[340px] py-2.5 pr-3">
                    <div className="truncate text-ink-100" title={r.title || r.sessionId}>{r.title || <span className="text-ink-400 italic">untitled</span>}</div>
                    <div className="num truncate text-[10px] text-ink-400" title={r.models}>{r.models.split(',').slice(0, 2).join(', ')}</div>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className="inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[11px]" style={{ color: c, borderColor: c + '40', background: c + '10' }}>
                      {TOOL_LABEL[r.tool]}{r.tool === 'hermes' && <span className="text-ink-300">· {r.profile}</span>}
                    </span>
                  </td>
                  <td className="num whitespace-nowrap py-2.5 pr-3 text-xs text-ink-300">{dhakaDateTime(r.lastTs)}</td>
                  <td className="num py-2.5 pr-3 text-right text-ink-300">{full(r.calls)}</td>
                  <td className="num py-2.5 pr-3 text-right text-ink-300">{human(r.input)}</td>
                  <td className="num py-2.5 pr-3 text-right text-ink-300">{human(r.output)}</td>
                  <td className="num py-2.5 pr-3 text-right text-ink-300">{prompt ? pct(r.cacheRead / prompt, 0) : '—'}</td>
                  <td className="py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1 w-20 overflow-hidden rounded-full bg-ink-800">
                        <div className="h-full rounded-full" style={{ width: `${(r.total / max) * 100}%`, background: c }} />
                      </div>
                      <span className="num w-16 text-right text-ink-100" title={full(r.total)}>{human(r.total, 2)}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows && !rows.length && <tr><td colSpan={8} className="py-8 text-center text-ink-400">No sessions in this range.</td></tr>}
          </tbody>
        </table>
      </div>
      {rows && rows.length > 12 && (
        <button onClick={() => setShowAll((v) => !v)} className="mt-3 text-xs text-ink-300 underline decoration-ink-600 underline-offset-4 hover:text-signal">
          {showAll ? 'Show less' : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  );
}
