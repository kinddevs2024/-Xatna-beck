import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createErrorResponse, createSuccessResponse } from '@/lib/middleware';
import { handleOptions } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function GET(request: NextRequest) {
  try {
    const bookings = await prisma.booking.findMany({
      where: {
        comment: {
          not: null,
        },
      },
      include: {
        client: true,
        doctor: true,
      },
      orderBy: { created_at: 'desc' },
    });

    return createSuccessResponse(bookings, 200, request);
  } catch (error: any) {
    return createErrorResponse(error.message || 'Xatolik yuz berdi', 500, request);
  }
}
