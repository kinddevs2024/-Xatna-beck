// Автоматическая инициализация Telegram бота при старте сервера
// Этот файл будет импортирован в server.js или в любом API route для гарантированной инициализации

import { telegramService } from './services/telegram.service';

let autoInitAttempted = false;

export async function autoInitializeTelegramBot() {
  if (autoInitAttempted) return;
  autoInitAttempted = true;

  // Проверяем наличие токена
  if (!process.env.BOT_TOKEN || process.env.BOT_TOKEN.trim() === '') {
    console.warn('[Telegram Auto-Init] ⚠️ BOT_TOKEN not found. Telegram bot will not be initialized.');
    return;
  }

  try {
    console.log('[Telegram Auto-Init] 🔄 Attempting to initialize Telegram Bot...');
    await telegramService.ensureInitialized();
    
    // Проверяем, что бот действительно инициализирован
    const isInitialized = telegramService.isInitialized();
    if (isInitialized) {
      console.log('[Telegram Auto-Init] ✅ Telegram Bot initialized successfully');
    } else {
      console.warn('[Telegram Auto-Init] ⚠️ Telegram Bot initialization attempted but not confirmed');
    }
  } catch (error: any) {
    console.error('[Telegram Auto-Init] ❌ Failed to initialize Telegram Bot:', error?.message || error);
  }
}

// НЕ вызываем автоматически при импорте - это может вызвать проблемы
// Вместо этого вызывайте autoInitializeTelegramBot() явно из server-init.ts или API routes
