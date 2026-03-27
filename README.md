# Show ts3 current users in discord text channel

Node.js + TypeScript. Production runs as a **one-shot** job: connect to TeamSpeak and Discord, update the configured text channel message, disconnect, exit. Use [Railway Cron Jobs](https://docs.railway.com/cron-jobs) to run `pnpm start` on a schedule (UTC). Railway enforces a **minimum interval of 5 minutes** between cron runs.

Copy [`.env.example`](.env.example) to `.env` and set the values below.

## Environment variables

| Variable | Description |
|----------|-------------|
| `HOST` | TeamSpeak server host |
| `QUERY_PORT` | ServerQuery port |
| `PORT` | TeamSpeak voice server port |
| `USERNAME` | ServerQuery username |
| `PASSWORD` | ServerQuery password |
| `NICKNAME` | Query client nickname |
| `DISCORD_TOKEN` | Discord bot token |
| `DISCORD_CHANNEL_ID` | Target text channel snowflake |

Optional (local dev HTTP server — used when `ENABLE_DEV_SERVER=true`):

| Variable | Description |
|----------|-------------|
| `ENABLE_DEV_SERVER` | Set to `true` to run the dev HTTP server and periodic updates. `pnpm run dev` sets this automatically. |
| `DEV_SERVER_PORT` | HTTP listen port for `/channels` and `/update` (default `3000`). This is **not** the same as TS3 `PORT`. |
| `DEV_UPDATE_INTERVAL_MS` | Interval in ms between Discord refreshes in dev (default `60000`). |

## Scripts

- `pnpm run build` — compile TypeScript to `dist/`
- `pnpm start` — run `dist/main.js` (production / Railway one-shot)
- `pnpm run dev` — dev mode: `ENABLE_DEV_SERVER=true`, `tsx watch src/main.ts` (HTTP + timed updates; reloads on file changes)
- `pnpm run dev:prod` — one-shot run via `tsx` (same behavior as production/Railway, no HTTP server)

## Railway

- **Build:** `pnpm install && pnpm run build`
- **Start:** `pnpm start`
- **Cron schedule:** e.g. `*/5 * * * *` for every 5 minutes (see Railway docs for limits)
