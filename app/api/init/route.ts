import { NextRequest, NextResponse } from 'next/server';
import { initializeServer } from '@/lib/server-init';
import { handleOptions, corsHeaders } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function POST(request: NextRequest) {
  try {
    await initializeServer();
    
    return NextResponse.json(
      { message: 'Server initialized successfully' },
      { headers: corsHeaders(request) }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Initialization failed' },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}
