// Dev: Hono API on API_PORT (default 4748, --watch) + Astro dev (proxies /api). Ctrl+C stops both.
import { spawn } from 'node:child_process';
const API_PORT = process.env.API_PORT ?? '4748';
const env = { ...process.env, API_PORT, PORT: API_PORT };
const kids = [
  spawn('npm', ['run', 'dev:api'], { stdio: 'inherit', env, shell: process.platform === 'win32' }),
  spawn('npm', ['run', 'dev:web'], { stdio: 'inherit', env, shell: process.platform === 'win32' }),
];
const stop = () => { for (const k of kids) { try { k.kill('SIGTERM'); } catch {} } process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const k of kids) k.on('exit', stop);
