# Token Tracker

Local, **read-only** AI token usage dashboard for **Hermes** (all profiles), **ZCode** and **Antigravity**.
Hono API + Astro/React/Tailwind v4/Recharts UI, served on a single port. Never deployed — sudhu nijer machine-e cholbe.


## Commands

```bash
npm install
npm run build        # build the Astro static UI into dist/
npm start            # Hono serves dist/ + /api on http://127.0.0.1:4747  (PORT=xxxx to change)
npm run dev          # Hono API (:4748, --watch) + Astro dev (:4321, proxies /api)
npm run collect      # one-shot ingest into data/usage.db (also runs on server start)
npm run typecheck
```

Env vars: `PORT` (4747), `HOST` (127.0.0.1), `TT_AUTO_REFRESH_MIN` (5; 0 = off), `TT_TZ_OFFSET` (6 = Asia/Dhaka), `TT_DB` (snapshot path).

Requires **Node ≥ 23.6** (uses built-in `node:sqlite` and native TypeScript type-stripping — no native deps, no build step for the server).

## Data sources (all opened read-only)

| Tool | Source | Granularity | `input` includes cache? |
|---|---|---|---|
| Hermes | `~/.hermes/state.db` (profile `default`) + `~/.hermes/profiles/<name>/state.db` (auto-discovered) → `session_model_usage`; fallback `sessions` for sessions without per-model rows | per session × model × provider × task | **No** — `input_tokens` is fresh only (cache_read is often ≫ input) |
| ZCode | `~/.zcode/cli/db/db.sqlite` → `model_usage` (+ `session.title`) | per request (`started_at` ms) | **Yes** — `input_tokens == raw inputTokens` and always ≥ cache_read, so fresh = input − cache_read − cache_creation |
| Antigravity | `~/.gemini/antigravity/brain/<id>/.system_generated/logs/transcript.jsonl` → `PLANNER_RESPONSE` lines; titles from `conversation_summaries.db` (title → preview fallback) | per model step (`created_at` ISO UTC) | **No** — fresh input drops when cache_read appears |

Foreign DBs are opened with `new DatabaseSync(path, { readOnly: true })`; if that ever fails (WAL/lock quirks) the collector copies db + `-wal` + `-shm` to a temp dir and reads the copy.

### Normalized record

```ts
{ tool, profile, model, provider, sessionId, sessionTitle, ts, date /* YYYY-MM-DD Asia/Dhaka */,
  input /* FRESH input */, output, cacheRead, cacheWrite, reasoning, calls, costUsd | null }
```

**Total tokens = fresh input + output + cache read + cache write** (no double counting). Reasoning tokens are shown separately and *not* added (providers already count them inside output).

## Snapshot (`data/usage.db`)

Every refresh (server start, every 5 min, `POST /api/refresh`, the UI **Refresh** button, or `npm run collect`) upserts normalized rows into `data/usage.db` (gitignored). Rows are never deleted, so history survives if Antigravity conversations or Hermes sessions are removed. Antigravity transcripts are re-parsed only when their mtime/size changes (full scan ≈3 s, incremental ≈100 ms).

## API

| Endpoint | Notes |
|---|---|
| `GET /api/summary?from=YYYY-MM-DD&to=YYYY-MM-DD` | today / yesterday / last7 / last30 / allTime / range totals + previous range, `byTool`, `byProfile` (source keys), `byModel`, last refresh info. `from=all` = since first record. Default range = last 30 days |
| `GET /api/daily?from&to` | per-day series, `sources` keyed `hermes:<profile>`, `zcode`, `antigravity` (zero-filled) |
| `GET /api/sessions?from&to&tool=&limit=` | top sessions by total tokens |
| `GET /api/hourly?date=` | 24 hourly buckets (local time) |
| `POST /api/refresh` | re-collect now; `GET` returns the last result |

## Caveats / jani rakhun

- **Hermes daily attribution:** `session_model_usage` is cumulative per session/model, so the whole row is dated by its `last_seen` (Asia/Dhaka). A long session spanning midnight lands entirely on its last day. `messages.token_count` exists but is empty, so per-message attribution isn't possible. Hourly view for Hermes uses the same `last_seen`.
- Hermes rows are keyed by (session, model, provider, base_url, mode, task); auxiliary tasks (`title_generation`, `vision`, …) are counted and labelled in the session title.
- **Antigravity has no model name** in transcripts → labelled `Antigravity (unknown)`. Cost is unknown.
- **ZCode** failed/rate-limited requests with zero tokens are skipped. No cost data.
- Cost only comes from Hermes `actual_cost_usd` (else `estimated_cost_usd`); most providers here report 0/unknown, so the UI doesn't lead with cost.
- Antigravity `step_index` can repeat in one transcript (agent restarts), so record IDs use step + timestamp + occurrence.
- Timezone is fixed UTC+6 (Bangladesh has no DST). Override with `TT_TZ_OFFSET`.
- Server binds to 127.0.0.1 only. Nothing is ever written to the source databases.

## Layout

```
server/
  index.ts            Hono app: /api + static dist/, initial collect, auto refresh
  app.ts              API routes
  queries.ts          summary / daily / sessions / hourly SQL
  store.ts            snapshot DB (data/usage.db), upsert + incremental refresh
  lib.ts              types, Dhaka date helpers, read-only DB opener
  collectors/         hermes.ts · zcode.ts · antigravity.ts
  cli-collect.ts      `npm run collect`
src/
  pages/index.astro   shell (React island, client:only)
  components/         Dashboard, Hero, KpiCards, DailyChart, ToolDonut, ModelBoard, CacheGauge, Heatmap, SessionsTable, ui
  lib/                api client, formatting, colors, count-up hook
  styles/global.css   Tailwind v4 theme, fonts (@fontsource: Inter, JetBrains Mono, Space Grotesk)
scripts/dev.mjs       runs API + Astro dev together
```

## Windows / Linux

Works on macOS, Linux and Windows (Node >= 23.6, uses built-in `node:sqlite` — no native build).
Data paths default to `~/.hermes`, `~/.zcode`, `~/.gemini/antigravity` under the user's home
(`%USERPROFILE%` on Windows). Override if a tool stores data elsewhere:

| Env var | Default |
|---|---|
| `TT_HERMES_HOME` (or `HERMES_HOME`) | `~/.hermes` |
| `TT_ZCODE_HOME` | `~/.zcode` |
| `TT_ANTIGRAVITY_HOME` | `~/.gemini/antigravity` |
| `TT_TZ_OFFSET` | machine timezone offset (hours) |

Missing sources are skipped. Windows PowerShell example: `$env:PORT=5000; npm start`.

## Background collection (no always-on server)

The dashboard server only needs to run while you look at it. History is kept by a scheduled
`collect` run (~1s, ~110 MB peak, then exits). One command on every OS:

```bash
npm run schedule:install     # macOS → launchd · Linux → crontab · Windows → Task Scheduler
npm run schedule:status
npm run schedule:uninstall
```
Interval: `TT_INTERVAL_MIN` (default 30), e.g. `TT_INTERVAL_MIN=60 npm run schedule:install`
(PowerShell: `$env:TT_INTERVAL_MIN=60; npm run schedule:install`). Re-run install after moving the folder.

| OS | Mechanism | Log |
|---|---|---|
| macOS | LaunchAgent `com.hasan.token-tracker-collect` (catches up after sleep) | `~/Library/Logs/token-tracker-collect.log` |
| Linux | user crontab line tagged `# token-tracker-collect` (needs `cron`/`cronie`) | `~/.local/state/token-tracker/collect.log` |
| Windows | Scheduled Task `TokenTrackerCollect`, hidden window, `StartWhenAvailable` | `%LOCALAPPDATA%\token-tracker\collect.log` |

Preview without changing anything: `node scripts/schedule.mjs install --dry-run --platform=win32`.

View: `npm start` → http://127.0.0.1:4747, Ctrl+C when done.
