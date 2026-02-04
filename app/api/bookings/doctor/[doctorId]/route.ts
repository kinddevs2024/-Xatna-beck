import { NextRequest, NextResponse } from 'next/server';
import { BookingService } from '@/lib/services/booking.service';
import { authMiddleware, createErrorResponse, createSuccessResponse } from '@/lib/middleware';
import { handleOptions } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { doctorId: string } }
) {
  try {
    const user = await authMiddleware(request);
    if (user instanceof NextResponse) {
      return user;
    }

    const doctorId = params.doctorId;
    if (!doctorId) {
      return createErrorResponse("Noto'g'ri doktor ID format", 400, request);
    }

    const bookingService = new BookingService();
    const bookings = await bookingService.findByDoctorId(doctorId);

    return createSuccessResponse(bookings, 200, request);
  } catch (error: any) {
    return createErrorResponse(error.message || 'Xatolik yuz berdi', 500, request);
  }
}
