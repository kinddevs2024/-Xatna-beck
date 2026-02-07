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

        // Ensure Telegram service is initialized
        await telegramService.ensureInitialized();

        // Handle the update by simulating a message or callback query
        if (body.message) {
            // Create a simulated TelegramBot.Message for the service
            const message = body.message as TelegramBot.Message;

            // Call the handler - we need to add this method to TelegramService
            await telegramService.handleWebhookMessage(message);
        } else if (body.callback_query) {
            // Create a simulated TelegramBot.CallbackQuery
            const query = body.callback_query as TelegramBot.CallbackQuery;

            // Call the handler - we need to add this method to TelegramService
            await telegramService.handleWebhookCallback(query);
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
