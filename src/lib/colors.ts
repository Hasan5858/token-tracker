export const TOOL_COLOR: Record<string, string> = {
  hermes: '#d4ff3a',
  zcode: '#3ad0ff',
  antigravity: '#ff8a3d',
  claude: '#e8825a',
  kimi: '#a78bfa',
};
export const TOOL_LABEL: Record<string, string> = {
  hermes: 'Hermes',
  zcode: 'ZCode',
  antigravity: 'Antigravity',
  claude: 'Claude Code',
  kimi: 'Kimi Code',
};

// Hermes profiles: lime first (default), then clearly distinct hues; ZCode cyan, Antigravity orange.
const HERMES_SHADES = ['#d4ff3a', '#34d399', '#fde047', '#c4b5fd', '#f472b6', '#94a3b8', '#86efac'];

export function sourceColor(key: string, allKeys: string[]): string {
  if (key === 'zcode') return TOOL_COLOR.zcode;
  if (!key.startsWith('hermes:') && TOOL_COLOR[key]) return TOOL_COLOR[key];
  const hermes = allKeys.filter((k) => k.startsWith('hermes:'));
  const i = Math.max(0, hermes.indexOf(key));
  return HERMES_SHADES[i % HERMES_SHADES.length];
}

export function sourceLabel(key: string): string {
  if (key.startsWith('hermes:')) return `Hermes · ${key.slice(7)}`;
  return TOOL_LABEL[key] ?? key;
}
