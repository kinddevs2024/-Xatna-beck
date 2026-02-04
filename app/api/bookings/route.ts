import { NextRequest, NextResponse } from 'next/server';
import { BookingService } from '@/lib/services/booking.service';
import { authMiddleware, createErrorResponse, createSuccessResponse, roleMiddleware } from '@/lib/middleware';
import { handleOptions } from '@/lib/cors';
import { CreateBookingDto, UserRole } from '@/types';
import { z } from 'zod';

// Schema for frontend compatibility (accepts barber_id and service_ids, but ignores service_ids)
const createBookingSchema = z.object({
  phone_number: z.string().min(1),
  doctor_id: z.union([z.string(), z.number()]).optional(),
  barber_id: z.union([z.string(), z.number()]).optional(),
  service_ids: z.array(z.union([z.string(), z.number()])).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
  client_name: z.string().optional(),
});

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function GET(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    if (user instanceof NextResponse) {
      return user;
    }

    if (!roleMiddleware([UserRole.ADMIN, UserRole.SUPER_ADMIN])(user)) {
      return createErrorResponse('Ruxsat yo\'q', 403, request);
    }

    const bookingService = new BookingService();
    const bookings = await bookingService.findAll();

    return createSuccessResponse(bookings, 200, request);
  } catch (error: any) {
    return createErrorResponse(error.message || 'Xatolik yuz berdi', 500, request);
  }
}

export async function POST(request: NextRequest) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch (parseError: any) {
      console.error('[POST /bookings] JSON parse error:', parseError);
      return createErrorResponse('Noto\'g\'ri JSON format', 400, request);
    }

    console.log('[POST /bookings] Received body:', JSON.stringify(body, null, 2));

    if (body.barber_id !== undefined && body.barber_id !== null && body.barber_id !== '') {
      body.barber_id = String(body.barber_id).trim();
    } else {
      body.barber_id = undefined;
    }

    if (body.doctor_id !== undefined && body.doctor_id !== null && body.doctor_id !== '') {
      body.doctor_id = String(body.doctor_id).trim();
    } else {
      body.doctor_id = undefined;
    }

    if (body.phone_number) {
      body.phone_number = String(body.phone_number).trim();
    }
    if (body.date) {
      body.date = String(body.date).trim();
    }
    if (body.time) {
      body.time = String(body.time).trim();
    }

    const validation = createBookingSchema.safeParse(body);
    if (!validation.success) {
      console.error('[POST /bookings] Validation error:', validation.error.errors);
      return createErrorResponse(
        `Noto'g'ri so'rov: ${validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        400,
        request
      );
    }

    const doctorId = validation.data.doctor_id || validation.data.barber_id;

    const bookingService = new BookingService();
    const createDto: CreateBookingDto = {
      phone_number: validation.data.phone_number,
      doctor_id: doctorId ? String(doctorId) : undefined,
      date: validation.data.date,
      time: validation.data.time,
      client_name: validation.data.client_name,
    };

    const booking = await bookingService.create(createDto);

    return createSuccessResponse(booking, 201, request);
  } catch (error: any) {
    return createErrorResponse(error.message || 'Xatolik yuz berdi', 500, request);
  }
}
