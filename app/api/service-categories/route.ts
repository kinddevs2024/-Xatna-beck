import { NextRequest, NextResponse } from 'next/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/middleware';
import { handleOptions } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

// Заглушка для совместимости с фронтендом
// У нас фиксированные 30 минут, поэтому категории услуг не нужны
export async function GET(request: NextRequest) {
  return createSuccessResponse([], 200, request);
}

// POST - категории не поддерживаются
export async function POST(request: NextRequest) {
  return createErrorResponse('Kategoriyalar qo\'llab-quvvatlanmaydi. Barcha xizmatlar 30 daqiqa.', 400, request);
}

// PUT - категории не поддерживаются
export async function PUT(request: NextRequest) {
  return createErrorResponse('Kategoriyalar qo\'llab-quvvatlanmaydi. Barcha xizmatlar 30 daqiqa.', 400, request);
}

// PATCH - категории не поддерживаются
export async function PATCH(request: NextRequest) {
  return createErrorResponse('Kategoriyalar qo\'llab-quvvatlanmaydi. Barcha xizmatlar 30 daqiqa.', 400, request);
}

// DELETE - категории не поддерживаются
export async function DELETE(request: NextRequest) {
  return createErrorResponse('Kategoriyalar qo\'llab-quvvatlanmaydi. Barcha xizmatlar 30 daqiqa.', 400, request);
}
