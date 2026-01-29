import { NextRequest, NextResponse } from 'next/server';
import { BookingService } from '@/lib/services/booking.service';
import { authMiddleware, createErrorResponse, createSuccessResponse } from '@/lib/middleware';
import { handleOptions } from '@/lib/cors';
import { UserRole } from '@/types';

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function GET(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    if (user instanceof NextResponse) {
      return user;
    }

    // Клиент может видеть только свои бронирования
    // Админ и супер-админ могут видеть все
    const bookingService = new BookingService();
    
    if (user.role === UserRole.CLIENT) {
      const bookings = await bookingService.findByClientId(user.id);
      return createSuccessResponse(bookings, 200, request);
    } else if (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN) {
      // Админы видят все бронирования
      const bookings = await bookingService.findAll();
      return createSuccessResponse(bookings, 200, request);
    } else {
      return createErrorResponse('Ruxsat yo\'q', 403, request);
    }
  } catch (error: any) {
    return createErrorResponse(error.message || 'Xatolik yuz berdi', 500, request);
  }
}
