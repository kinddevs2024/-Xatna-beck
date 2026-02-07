// Этот файл инициализирует сервер при старте (не в Edge Runtime)
// Импортируйте его в любом API route для автоматической инициализации

import { initializeDatabase } from './init';
import { telegramService } from './services/telegram.service';
import { autoInitializeTelegramBot } from './telegram-auto-init';
import { validateEnv } from './env-validation';

// Suppress noisy DeprecationWarning from legacy `url.parse()` usage in
// third-party libraries. We only filter deprecation messages that mention
// `url.parse` to avoid hiding other important warnings.
if (typeof process !== 'undefined' && typeof process.on === 'function') {
  process.on('warning', (warning: any) => {
    try {
      const msg = String(warning?.message || '');
      const stack = String(warning?.stack || '');
      if (warning && warning.name === 'DeprecationWarning' && (/url\.parse\(|\\burl\.parse\b/i.test(msg + stack))) {
        // Intentionally ignore this specific deprecation to avoid polluting logs
        return;
      }
    } catch (e) {
      // If anything goes wrong, fall through to default logging below
    }

    // Default behavior: log the warning to console
    // Keep formatting similar to Node's default output
    try {
      console.warn(`Warning: ${warning.name}: ${warning.message}`);
      if (warning.stack) console.warn(warning.stack);
    } catch (e) {
      // noop
    }
  });
}

let serverInitialized = false;

export async function initializeServer() {
  if (serverInitialized) return;

  try {
    // Validate environment variables
    validateEnv();

    // Инициализируем базу данных (с встроенной обработкой ошибок)
    try {
      await initializeDatabase();
    } catch (dbError: any) {
      console.warn('[Server Init] ⚠️ Database initialization warning:', dbError?.message || dbError);
      // Продолжаем, даже если инициализация базы данных не удалась
      // Реальные запросы к БД могут работать
    }

    // Инициализируем Telegram бота (принудительно)
    if (process.env.BOT_TOKEN && process.env.BOT_TOKEN.trim() !== '') {
      console.log('[Server Init] 🔄 Initializing Telegram Bot...');
      await telegramService.ensureInitialized();

      // Проверяем статус
      const isInitialized = telegramService.isInitialized();
      if (isInitialized) {
        console.log('[Server Init] ✅ Telegram Bot initialized');
      } else {
        console.warn('[Server Init] ⚠️ Telegram Bot initialization failed or not confirmed');
      }
    } else {
      console.warn('[Server Init] ⚠️ BOT_TOKEN not configured');
    }

    serverInitialized = true;
    console.log('[Server Init] ✅ Server initialized successfully');
  } catch (error: any) {
    console.error('[Server Init] ❌ Server initialization error:', error?.message || error);
    // Не бросаем ошибку, позволяем серверу продолжать работу
  }
}

// Автоматически инициализируем Telegram бота при импорте (если не в Edge Runtime)
if (typeof process !== 'undefined' && process.env && !process.env.NEXT_RUNTIME) {
  // Небольшая задержка для запуска сервера
  const initializeBot = async () => {
    try {
      await new Promise(r => setTimeout(r, 500));
      console.log('[Server Init] 🤖 Auto-initializing Telegram Bot...');
      await autoInitializeTelegramBot();
    } catch (err: any) {
      console.error('[Server Init] ⚠️ Auto-init failed:', err?.message);
    }
  };

  initializeBot();
}
