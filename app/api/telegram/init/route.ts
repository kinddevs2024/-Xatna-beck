import { NextResponse } from 'next/server';
import { telegramService } from '@/lib/services/telegram.service';
import { handleTelegramOptions, telegramCorsHeaders } from '@/lib/telegram-http';
import { initializeServer } from '@/lib/server-init';

export async function OPTIONS() {
  return handleTelegramOptions();
}

export async function POST() {
  try {
    console.log('[POST /api/telegram/init] Forcing Telegram Bot initialization...');

    if (!process.env.BOT_TOKEN || process.env.BOT_TOKEN.trim() === '') {
      return NextResponse.json(
        {
          success: false,
          error: 'BOT_TOKEN not configured',
          message: 'Please set BOT_TOKEN in .env file',
        },
        { status: 400, headers: telegramCorsHeaders() }
      );
    }

    await initializeServer();
    await telegramService.ensureInitialized();

    const isInitialized = telegramService.isInitialized();
    const hasToken = !!process.env.BOT_TOKEN;

    if (isInitialized) {
      const bot = telegramService.getBot();
      let botInfo = null;
      if (bot) {
        try {
          botInfo = await bot.getMe();
        } catch (error) {
          console.error('[POST /api/telegram/init] Error getting bot info:', error);
        }
      }

      return NextResponse.json(
        {
          success: true,
          initialized: true,
          hasToken: true,
          message: 'Telegram Bot initialized successfully',
          botInfo: botInfo
            ? {
                username: botInfo.username,
                first_name: botInfo.first_name,
                id: botInfo.id,
              }
            : null,
        },
        { status: 200, headers: telegramCorsHeaders() }
      );
    }

    return NextResponse.json(
      {
        success: false,
        initialized: false,
        hasToken,
        message: 'Telegram Bot initialization failed or not confirmed',
        error: 'Bot was not initialized properly',
      },
      { status: 500, headers: telegramCorsHeaders() }
    );
  } catch (error: any) {
    console.error('[POST /api/telegram/init] Error:', error);
    return NextResponse.json(
      {
        success: false,
        initialized: false,
        error: error.message || 'Unknown error',
        hasToken: !!process.env.BOT_TOKEN,
      },
      { status: 500, headers: telegramCorsHeaders() }
    );
  }
}

export async function GET() {
  return POST();
}
