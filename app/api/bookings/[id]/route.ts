import { NextRequest, NextResponse } from 'next/server';
import { BookingService } from '@/lib/services/booking.service';
import { authMiddleware, createErrorResponse, createSuccessResponse, roleMiddleware } from '@/lib/middleware';
import { handleOptions, corsHeaders } from '@/lib/cors';
import { BookingStatus, UserRole } from '@/types';
import { z } from 'zod';

const updateStatusSchema = z.object({
  status: z.nativeEnum(BookingStatus),
});

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authMiddleware(request);
    if (user instanceof NextResponse) {
      return user;
    }

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return createErrorResponse("Noto'g'ri ID format", 400, request);
    }

    const bookingService = new BookingService();
    const booking = await bookingService.findOne(id);

    if (!booking) {
      return createErrorResponse('Bron topilmadi', 404, request);
    }

    return createSuccessResponse(booking, 200, request);
  } catch (error: any) {
    return createErrorResponse(error.message || 'Xatolik yuz berdi', 500, request);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authMiddleware(request);
    if (user instanceof NextResponse) {
      return user;
    }

    // Проверка роли
    if (!roleMiddleware([UserRole.ADMIN, UserRole.SUPER_ADMIN])(user)) {
      return createErrorResponse('Ruxsat yo\'q', 403, request);
    }

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return createErrorResponse("Noto'g'ri ID format", 400, request);
    }

    const body = await request.json();
    const validation = updateStatusSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse('Noto\'g\'ri so\'rov', 400, request);
    }

    const bookingService = new BookingService();
    const booking = await bookingService.updateStatus(id, validation.data.status);

    return createSuccessResponse(booking, 200, request);
  } catch (error: any) {
    return createErrorResponse(error.message || 'Xatolik yuz berdi', 500, request);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authMiddleware(request);
    if (user instanceof NextResponse) {
      return user;
    }

    // Проверка роли
    if (!roleMiddleware([UserRole.ADMIN, UserRole.SUPER_ADMIN])(user)) {
      return createErrorResponse('Ruxsat yo\'q', 403, request);
    }

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return createErrorResponse("Noto'g'ri ID format", 400, request);
    }

    const bookingService = new BookingService();
    await bookingService.remove(id);

    return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
  } catch (error: any) {
    return createErrorResponse(error.message || 'Xatolik yuz berdi', 500, request);
  }
}
