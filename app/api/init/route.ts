import { NextRequest, NextResponse } from 'next/server';
import { initializeServer } from '@/lib/server-init';
import { telegramService } from '@/lib/services/telegram.service';
import { handleOptions, corsHeaders } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function POST(request: NextRequest) {
  try {
    console.log('[Init Route] 🚀 Initializing server...');
    await initializeServer();

    // Ensure Telegram bot is running
    if (process.env.BOT_TOKEN && process.env.BOT_TOKEN.trim() !== '') {
      console.log('[Init Route] 🤖 Ensuring Telegram bot is running...');
      await telegramService.ensureInitialized();
    }

    const botStatus = telegramService.isInitialized();

    return NextResponse.json(
      {
        message: 'Server initialized successfully',
        telegramBot: {
          status: botStatus ? 'running' : 'not_running',
          configured: !!process.env.BOT_TOKEN
        }
      },
      { headers: corsHeaders(request) }
    );
  } catch (error: any) {
    console.error('[Init Route] ❌ Error:', error?.message);
    return NextResponse.json(
      { error: error.message || 'Initialization failed' },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}

