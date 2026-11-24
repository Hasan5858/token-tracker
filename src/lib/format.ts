const UNITS: [number, string][] = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];

/** 1234 -> 1.2K, 28_700_000_000 -> 28.7B */
export function human(n: number | null | undefined, digits = 1): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  for (const [d, s] of UNITS) {
    if (a >= d) {
      const x = v / d;
      return `${x.toFixed(Math.abs(x) >= 100 ? 0 : digits).replace(/\.0+$/, '')}${s}`;
    }
  }
  return Math.round(v).toLocaleString('en-US');
}

/** Split for display: { value: '28.7', unit: 'B' } */
export function humanParts(n: number): { value: string; unit: string } {
  const h = human(n, n >= 1e3 ? 2 : 0);
  const m = h.match(/^(-?[\d.,]+)([A-Z]?)$/);
  return m ? { value: m[1], unit: m[2] } : { value: h, unit: '' };
}

export const full = (n: number | null | undefined) => Math.round(Number(n ?? 0)).toLocaleString('en-US');
export const pct = (n: number, d = 1) => `${(n * 100).toFixed(d)}%`;
export const usd = (n: number | null | undefined) => (n == null ? '—' : n < 0.01 && n > 0 ? '<$0.01' : `$${n.toFixed(2)}`);

export function delta(cur: number, prev: number): { text: string; dir: 'up' | 'down' | 'flat' } {
  if (!prev && !cur) return { text: '—', dir: 'flat' };
  if (!prev) return { text: 'new', dir: 'up' };
  const r = (cur - prev) / prev;
  if (Math.abs(r) < 0.005) return { text: '0%', dir: 'flat' };
  return { text: `${r > 0 ? '+' : ''}${(r * 100).toFixed(Math.abs(r) >= 10 ? 0 : 1)}%`, dir: r > 0 ? 'up' : 'down' };
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function shortDate(d: string): string {
  const [, m, day] = d.split('-');
  return `${MON[Number(m) - 1]} ${Number(day)}`;
}

export function ago(tsSec: number | undefined): string {
  if (!tsSec) return 'never';
  const s = Math.max(0, Date.now() / 1000 - tsSec);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

/** Local Dhaka-ish date for timestamp, matching server attribution (UTC+6). */
export function dhakaDateTime(tsSec: number): string {
  const d = new Date((tsSec + 6 * 3600) * 1000).toISOString();
  return `${shortDate(d.slice(0, 10))} · ${d.slice(11, 16)}`;
}
