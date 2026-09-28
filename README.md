# Tembo Forex Bot — Frontend

Dashboard for the [Tembo Forex Bot backend](https://github.com/Ngaatembo/Tembo-forex-bot): decision engine, market prices, paper account, research evidence, and the macro calendar.

**Paper and Deriv demo only.** The frontend holds no API keys and never talks to a broker. Almost every call is a read-only GET. The only POSTs are the Deriv *demo* controls on the Dashboard (quote → confirm → close), and the backend re-checks each one against Tembo's current decision, paper eligibility and demo-only mode before touching the demo account.

## Pages

| Page | Backend endpoints |
|---|---|
| Dashboard (`#/live`) | `/live/market`, `/live/decision`, `/live/analysis`, `/live/analysis/multi-timeframe`, `/live/synthetic-symbols`, `/runtime/status`, `/risk/metrics`, `/deriv/status`, `/deriv/demo/*` |
| Live Markets | `/live/market` |
| Trade Signals | `/decisions?instrument=…&timeframe=h1` |
| Paper Trading | `/runtime/status`, `/runtime/positions`, `/runtime/trades`, `/runtime/metrics`, `/runtime/events`, `/risk/metrics`, `/validation` |
| News & Calendar | `/calendar`, `/calendar/{currency}`, `/news`, `/system/data-status` |
| Research | `/research/candidates`, `/research/families`, `/research/baseline` + `src/data/researchSnapshot.json` |
| System Overview | `/health`, `/decisions`, `/runtime/status`, `/calendar` |
| Test Lab | `/validation`, `/runtime/*`, `/backtests/readiness`, `/live/decision` |

### Dashboard rules

- Every price, candle, level and signal comes from the backend. If the backend has no verified data the screen says so instead of drawing anything.
- BUY / SELL / NO TRADE, entry, stop, target, confidence and risk are shown exactly as `/live/decision` returns them. The browser never computes a trade.
- The SMA 10/50 lines on the chart are a drawing aid computed from the verified candles; the legend and analysis cards use the backend's own values.
- The chart uses TradingView's open-source [Lightweight Charts](https://github.com/tradingview/lightweight-charts) (Apache-2.0); its attribution logo stays on.

## Run locally

```bash
npm install
cp .env.example .env.local   # points at the live Render backend by default
npm run dev                  # http://localhost:5173
```

## Deploy (Cloudflare)

Pushing to `main` runs `.github/workflows/cloudflare-deploy.yml`, which builds and deploys the `tembobot` Worker (see `wrangler.jsonc`).

## Deploy (Vercel, alternative)

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

Stack: React 19, TypeScript, Vite 7, Tailwind CSS 4, Lightweight Charts, Recharts, lucide-react.
