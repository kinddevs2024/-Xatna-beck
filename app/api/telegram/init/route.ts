import { NextRequest, NextResponse } from 'next/server';
import { telegramService } from '@/lib/services/telegram.service';
import { handleOptions } from '@/lib/cors';
import { autoInitializeTelegramBot } from '@/lib/telegram-auto-init';

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function POST(request: NextRequest) {
  try {
    console.log('[POST /api/telegram/init] Forcing Telegram Bot initialization...');
    
    // Проверяем наличие токена
    if (!process.env.BOT_TOKEN || process.env.BOT_TOKEN.trim() === '') {
      return NextResponse.json({
        success: false,
        error: 'BOT_TOKEN not configured',
        message: 'Please set BOT_TOKEN in .env file'
      }, { status: 400 });
    }

    // Принудительно инициализируем бота
    await autoInitializeTelegramBot();
    
    // Дополнительно вызываем ensureInitialized
    await telegramService.ensureInitialized();
    
    const isInitialized = telegramService.isInitialized();
    const hasToken = !!process.env.BOT_TOKEN;

    if (isInitialized) {
      // Пытаемся получить информацию о боте
      const bot = telegramService.getBot();
      let botInfo = null;
      if (bot) {
        try {
          botInfo = await bot.getMe();
        } catch (error) {
          console.error('[POST /api/telegram/init] Error getting bot info:', error);
        }
      }

      return NextResponse.json({
        success: true,
        initialized: true,
        hasToken: true,
        message: 'Telegram Bot initialized successfully',
        botInfo: botInfo ? {
          username: botInfo.username,
          first_name: botInfo.first_name,
          id: botInfo.id
        } : null
      }, { status: 200 });
    } else {
      return NextResponse.json({
        success: false,
        initialized: false,
        hasToken: hasToken,
        message: 'Telegram Bot initialization failed or not confirmed',
        error: 'Bot was not initialized properly'
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('[POST /api/telegram/init] Error:', error);
    return NextResponse.json({
      success: false,
      initialized: false,
      error: error.message || 'Unknown error',
      hasToken: !!process.env.BOT_TOKEN
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  // GET тоже инициализирует бота
  return POST(request);
}
