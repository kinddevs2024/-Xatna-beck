import { NextRequest, NextResponse } from 'next/server';
import { BookingService } from '@/lib/services/booking.service';
import { UserService } from '@/lib/services/user.service';
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

    // Получить default доктора
    const userService = new UserService();
    const doctor = await userService.findDefaultDoctor();
    
    if (!doctor) {
      return createErrorResponse('Doktor topilmadi', 404, request);
    }

    const bookingService = new BookingService();
    const bookings = await bookingService.findByDoctorId(doctor.id);

    return createSuccessResponse(bookings, 200, request);
  } catch (error: any) {
    return createErrorResponse(error.message || 'Xatolik yuz berdi', 500, request);
  }
}
