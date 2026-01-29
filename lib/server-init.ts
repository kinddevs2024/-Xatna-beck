// Этот файл инициализирует сервер при старте (не в Edge Runtime)
// Импортируйте его в любом API route для автоматической инициализации

import { initializeDatabase } from './init';
import { telegramService } from './services/telegram.service';
import { autoInitializeTelegramBot } from './telegram-auto-init';
import { validateEnv } from './env-validation';

let serverInitialized = false;

export async function initializeServer() {
  if (serverInitialized) return;
  
  try {
    // Validate environment variables
    validateEnv();
    
    // Инициализируем базу данных
    await initializeDatabase();
    
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
  }
}

// Автоматически инициализируем Telegram бота при импорте (если не в Edge Runtime)
if (typeof process !== 'undefined' && process.env && !process.env.NEXT_RUNTIME) {
  // Небольшая задержка для запуска сервера
  setTimeout(() => {
    autoInitializeTelegramBot().catch(console.error);
  }, 1000);
}
