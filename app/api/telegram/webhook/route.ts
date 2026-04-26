/**
 * Telegram Webhook Handler for Vercel
 * This endpoint receives updates from Telegram instead of using polling
 */

import { NextRequest, NextResponse } from 'next/server';
import { telegramService } from '@/lib/services/telegram.service';
import TelegramBot from 'node-telegram-bot-api';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        console.log('[Telegram Webhook] Received update:', {
            update_id: body.update_id,
            message: body.message?.text?.substring(0, 50),
            callback_query: body.callback_query?.data?.substring(0, 50)
        });

        // Ensure Telegram service is initialized (webhook mode: polling off)
        await telegramService.ensureInitialized();

        const bot = telegramService.getBot();
        if (bot && typeof (bot as TelegramBot & { processUpdate?: (u: unknown) => void }).processUpdate === 'function') {
            // Роутит update во все onText / callback_query — как при polling
            (bot as TelegramBot & { processUpdate: (u: unknown) => void }).processUpdate(body);
        } else if (body.message) {
            await telegramService.handleWebhookMessage(body.message as TelegramBot.Message);
        } else if (body.callback_query) {
            await telegramService.handleWebhookCallback(body.callback_query as TelegramBot.CallbackQuery);
        }

        // Return success to Telegram
        return NextResponse.json({
            ok: true,
            message: 'Update processed'
        });
    } catch (error: any) {
        console.error('[Telegram Webhook] Error:', error?.message || error);

        // Still return 200 to acknowledge receipt
        return NextResponse.json({
            ok: false,
            error: error?.message || 'Unknown error'
        }, { status: 200 });
    }
}

export async function GET(request: NextRequest) {
    return NextResponse.json({
        status: 'Telegram webhook endpoint is active',
        method: 'POST',
        info: 'Send Telegram updates via POST request'
    });
}
