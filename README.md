# Show ts3 current users in discord text channel

Node.js + TypeScript. By default the app runs a **long-lived** process: it connects to TeamSpeak and Discord, serves HTTP (`/channels`, `/update`), and refreshes the configured text channel on an interval. For platforms that only support **one-shot** scheduled jobs (e.g. Railway Cron), set `ONE_SHOT=true` so each run connects, updates the message, disconnects, and exits.

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

| Variable | Description |
|----------|-------------|
| `ONE_SHOT` | Set to `true` for one-shot mode (no HTTP server; update once and exit). Use for Railway Cron–style schedules. |
| `DEV_SERVER_PORT` | HTTP listen port for `/channels` and `/update` (default `3000`). This is **not** the same as TS3 `PORT`. |
| `DEV_UPDATE_INTERVAL_MS` | Interval in ms between Discord refreshes in long-lived mode (default `60000`). |

## Scripts

- `pnpm run build` — compile TypeScript to `dist/`
- `pnpm start` — run `dist/main.js` (long-lived HTTP server + periodic Discord updates by default)
- `pnpm run dev` — `tsx watch src/main.ts` (same as production behavior; reloads on file changes)
- `pnpm run dev:prod` — one-shot via `tsx` (`ONE_SHOT=true`; same as cron-style production)

## Railway

- **Build:** `pnpm install && pnpm run build`
- **Start:** `pnpm start`
- **Cron (one-shot):** set `ONE_SHOT=true` and use a schedule such as `*/5 * * * *` (see [Railway Cron Jobs](https://docs.railway.com/cron-jobs); minimum interval is often 5 minutes, UTC).
