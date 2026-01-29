import { NextRequest, NextResponse } from 'next/server';
import { telegramService } from '@/lib/services/telegram.service';

// Этот endpoint инициализирует Telegram бота
// Вызывается автоматически при первом запросе к API
export async function GET(request: NextRequest) {
  try {
    const isInitialized = telegramService.isInitialized();
    return NextResponse.json({
      initialized: isInitialized,
      message: isInitialized ? 'Telegram Bot is running' : 'Telegram Bot not initialized'
    });
  } catch (error: any) {
    return NextResponse.json({
      initialized: false,
      error: error.message
    }, { status: 500 });
  }
}
