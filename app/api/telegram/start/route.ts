/**
 * Dedicated endpoint to start and maintain Telegram bot polling
 * This keeps the bot alive and listening for messages
 */

import { NextResponse } from 'next/server';
import telegramService from '@/lib/services/telegram.service';
import { initializeServer } from '@/lib/server-init';
import { handleTelegramOptions, telegramCorsHeaders } from '@/lib/telegram-http';

// Increase timeout for this endpoint
export const maxDuration = 60;

export async function GET() {
    try {
        console.log('[Telegram Start] 🔄 Starting Telegram bot...');

        // Initialize server first
        await initializeServer();

        // First attempt to initialize the telegram service
        await telegramService.ensureInitialized();
        let isInitialized = telegramService.isInitialized();

        if (!isInitialized) {
            console.log('[Telegram Start] ⚠️ Initial initialization did not confirm. Resetting bot state and retrying...');
            await (telegramService as any).resetBot();
            isInitialized = telegramService.isInitialized();
        }

        if (isInitialized) {
            console.log('[Telegram Start] ✅ Telegram bot is running and listening');
            return NextResponse.json(
                {
                    status: 'running',
                    message: 'Telegram bot is active and listening for messages',
                    timestamp: new Date().toISOString()
                },
                { status: 200, headers: telegramCorsHeaders() }
            );
        }

        console.warn('[Telegram Start] ⚠️ Bot initialization attempted but still not confirmed');
        return NextResponse.json(
            {
                status: 'initializing',
                message: 'Telegram bot initialization in progress or failed, retry complete',
                timestamp: new Date().toISOString()
            },
            { status: 202, headers: telegramCorsHeaders() }
        );
    } catch (error: any) {
        console.error('[Telegram Start] ❌ Error:', error?.message || error);
        return NextResponse.json(
            {
                status: 'error',
                message: error?.message || 'Failed to start Telegram bot',
                error: error?.toString()
            },
            { status: 500, headers: telegramCorsHeaders() }
        );
    }
}

export async function OPTIONS() {
    return handleTelegramOptions();
}
