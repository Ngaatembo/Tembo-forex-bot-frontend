// Serves the built site and keeps the free Render backend awake.
//
// Render puts a free web service to sleep after 15 minutes without a
// request. While it sleeps, Tembo's background jobs (phone alerts, paper
// runtime, results scoreboard) stop. A small request every 10 minutes keeps
// them running. The ping only reads /health; it carries no credentials.
const BACKEND_HEALTH = 'https://tembo-forex-bot.onrender.com/health';

export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
  async scheduled(_event, _env, ctx) {
    ctx.waitUntil(
      fetch(BACKEND_HEALTH, { headers: { 'user-agent': 'tembo-keepalive/1.0' } }).catch(() => undefined),
    );
  },
};
