import { NextResponse } from 'next/server';
import { telegramService } from '@/lib/services/telegram.service';
import { handleTelegramOptions, telegramCorsHeaders } from '@/lib/telegram-http';

export async function OPTIONS() {
  return handleTelegramOptions();
}

export async function GET() {
  try {
    // Инициализируем сервер, если еще не инициализирован
    const { initializeServer } = await import('@/lib/server-init');
    await initializeServer();
    
    // Пытаемся инициализировать бота, если он еще не инициализирован
    await telegramService.ensureInitialized();
    
    const isInitialized = telegramService.isInitialized();
    const hasToken = !!process.env.BOT_TOKEN;
    
    return NextResponse.json(
      {
        initialized: isInitialized,
        hasToken: hasToken,
        message: isInitialized
          ? 'Telegram Bot is running'
          : hasToken
            ? 'Telegram Bot initialization in progress or failed'
            : 'BOT_TOKEN not configured',
      },
      { status: 200, headers: telegramCorsHeaders() }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        initialized: false,
        error: error.message || 'Unknown error',
        hasToken: !!process.env.BOT_TOKEN,
      },
      { status: 500, headers: telegramCorsHeaders() }
    );
  }
}
