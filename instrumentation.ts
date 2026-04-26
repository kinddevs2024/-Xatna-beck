/**
 * Runs once when the Node.js server starts (next dev / next start).
 * Ensures Telegram polling and DB init run without opening /api/init first.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'edge') {
    return;
  }
  if (!process.env.BOT_TOKEN?.trim()) {
    console.warn('[instrumentation] BOT_TOKEN empty — skip auto-init (use `npm run bot` for polling).');
    return;
  }

  try {
    const { initializeServer } = await import('./lib/server-init');
    void initializeServer().catch((err: unknown) => {
      console.error('[instrumentation] initializeServer failed:', err);
    });
  } catch (e) {
    console.error('[instrumentation] Failed to load server-init:', e);
  }
}
