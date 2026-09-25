# Tembo Forex Bot — Frontend

Dashboard for the [Tembo Forex Bot backend](https://github.com/Ngaatembo/Tembo-forex-bot): decision engine, market prices, paper account, research evidence, and the macro calendar.

**Paper trading only.** This app only reads from the backend (every backend route is GET-only). It holds no API keys and cannot place trades.

## Pages

| Page | Backend endpoints |
|---|---|
| Overview | `/health`, `/decisions`, `/account/overview`, `/calendar` |
| Decisions | `/decisions?instrument=…&timeframe=h1` |
| Markets | `/markets/{instrument}?timeframe=h1` |
| Paper account | `/account/overview`, `/positions/open`, `/positions/closed`, `/risk/metrics`, `/performance`, `/events` |
| Research | `/research/candidates`, `/research/families`, `/research/baseline` + a snapshot of Edge Validation Experiments 1–2 (`src/data/researchSnapshot.json`) |
| News & calendar | `/calendar`, `/calendar/{currency}`, `/news`, `/system/data-status` |

## Run locally

```bash
npm install
cp .env.example .env.local   # points at the live Render backend by default
npm run dev                  # http://localhost:5173
```

## Deploy (Vercel)

1. Import this repo in Vercel. Framework preset: **Vite**. Build command `npm run build`, output `dist`.
2. Environment variable (optional, this is the default): `VITE_API_BASE_URL=https://tembo-forex-bot.onrender.com`
3. After the first deploy, copy the Vercel URL and add it to the backend on Render:
   **Render → tembo-forex-bot → Environment → `CORS_ALLOWED_ORIGINS`**, comma-separated, no trailing slash, e.g.
   `https://tembo-forex-bot-frontend.vercel.app,http://localhost:5173`
   Without this the browser blocks every request.

## Notes

- Render's free tier sleeps. The first request after a quiet spell can take 30–60 seconds; the app shows a "waking server" banner and retries by itself.
- Routing uses URL hashes (`#/decisions/XAU%2FUSD`), so no server rewrite rules are needed on any host.
- The research snapshot is static. Regenerate it from `research/results/*.json` in the backend repo when new experiments land.

Stack: React 19, TypeScript, Vite 7, Tailwind CSS 4, Recharts, lucide-react.
