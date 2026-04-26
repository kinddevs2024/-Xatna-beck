/**
 * Run the Telegram bot with long polling in a plain Node process.
 * This is the supported way to get reliable replies to /start (Next.js alone is not ideal for polling).
 *
 * Usage: npm run bot
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(process.cwd(), '.env') });

process.env.TELEGRAM_USE_WEBHOOK = process.env.TELEGRAM_USE_WEBHOOK || 'false';

async function main() {
  const { validateEnv, assertBotToken } = await import('../lib/env-validation');
  validateEnv();
  assertBotToken();

  const { initializeDatabase } = await import('../lib/init');
  await initializeDatabase();

  const { telegramService } = await import('../lib/services/telegram.service');
  await telegramService.ensureInitialized();

  if (!telegramService.isInitialized()) {
    console.error('[bot] Telegram bot did not start (see errors above).');
    process.exit(1);
  }

  console.log('[bot] Polling is active. Send /start to your bot in Telegram. Press Ctrl+C to stop.');

  const shutdown = async () => {
    try {
      await telegramService.stopPolling();
    } catch {
      /* noop */
    }
    const { prisma } = await import('../lib/db');
    await prisma.$disconnect().catch(() => {});
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((err) => {
  console.error('[bot] Fatal:', err);
  process.exit(1);
});
