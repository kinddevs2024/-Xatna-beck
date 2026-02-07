/**
 * Dedicated endpoint to start and maintain Telegram bot polling
 * This keeps the bot alive and listening for messages
 */

import { NextRequest, NextResponse } from 'next/server';
import { telegramService } from '@/lib/services/telegram.service';
import { initializeServer } from '@/lib/server-init';

// Increase timeout for this endpoint
export const maxDuration = 60;

export async function GET(request: NextRequest) {
    try {
        console.log('[Telegram Start] 🔄 Starting Telegram bot...');

        // Initialize server first
        await initializeServer();

        // Ensure telegram service is initialized
        await telegramService.ensureInitialized();

        // Check if it's actually running
        const isInitialized = telegramService.isInitialized();

        if (isInitialized) {
            console.log('[Telegram Start] ✅ Telegram bot is running and listening');
            return NextResponse.json(
                {
                    status: 'running',
                    message: 'Telegram bot is active and listening for messages',
                    timestamp: new Date().toISOString()
                },
                { status: 200 }
            );
        } else {
            console.warn('[Telegram Start] ⚠️ Bot initialization attempted but not confirmed');
            return NextResponse.json(
                {
                    status: 'initializing',
                    message: 'Telegram bot initialization in progress',
                    timestamp: new Date().toISOString()
                },
                { status: 202 }
            );
        }
    } catch (error: any) {
        console.error('[Telegram Start] ❌ Error:', error?.message || error);
        return NextResponse.json(
            {
                status: 'error',
                message: error?.message || 'Failed to start Telegram bot',
                error: error?.toString()
            },
            { status: 500 }
        );
    }
}

export async function OPTIONS(request: NextRequest) {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS, POST',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}
