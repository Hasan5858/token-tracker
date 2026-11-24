import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { api } from './app.ts';
import { refresh } from './store.ts';
import { ROOT } from './lib.ts';

const PORT = Number(process.env.PORT ?? 4747);
const HOST = process.env.HOST ?? '127.0.0.1'; // local-only by default
const app = new Hono();
app.route('/api', api);

const dist = join(ROOT, 'dist');
if (existsSync(dist)) {
  const rootRel = relative(process.cwd(), dist) || '.';
  app.use('/*', serveStatic({ root: rootRel }));
  app.get('*', serveStatic({ path: join(rootRel, 'index.html') }));
} else {
  app.get('/', (c) => c.text('Token Tracker API is running. Run `npm run build` for the UI, or `npm run dev`.'));
}

const r = await refresh();
console.log(`[collect] ${r.upserted} records upserted in ${r.ms}ms (snapshot rows: ${r.totalRows})`);
if (r.errors.length) console.warn('[collect] errors:', r.errors);

const AUTO_MIN = Number(process.env.TT_AUTO_REFRESH_MIN ?? 5);
if (AUTO_MIN > 0) setInterval(() => refresh().catch((e) => console.error('[auto-refresh]', e)), AUTO_MIN * 60_000).unref();

serve({ fetch: app.fetch, port: PORT, hostname: HOST }, (info) => {
  console.log(`Token Tracker → http://${HOST}:${info.port}`);
});
