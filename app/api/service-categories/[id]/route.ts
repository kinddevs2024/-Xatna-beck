import { NextRequest, NextResponse } from 'next/server';
import { createErrorResponse } from '@/lib/middleware';
import { handleOptions } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

// PATCH - категории не поддерживаются
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return createErrorResponse('Kategoriyalar qo\'llab-quvvatlanmaydi. Barcha xizmatlar 30 daqiqa.', 400, request);
}

// DELETE - категории не поддерживаются
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return createErrorResponse('Kategoriyalar qo\'llab-quvvatlanmaydi. Barcha xizmatlar 30 daqiqa.', 400, request);
}

// GET - категории не поддерживаются
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return createErrorResponse('Kategoriyalar qo\'llab-quvvatlanmaydi. Barcha xizmatlar 30 daqiqa.', 400, request);
}
