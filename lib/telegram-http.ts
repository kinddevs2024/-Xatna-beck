import { NextResponse } from 'next/server';

/** Minimal CORS for Telegram / debugging tools hitting API routes */
export function telegramCorsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS, POST',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export function handleTelegramOptions(): NextResponse {
  return new NextResponse(null, { status: 200, headers: telegramCorsHeaders() });
}
