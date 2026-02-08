import { NextRequest, NextResponse } from 'next/server';
import { BookingService } from '@/lib/services/booking.service';
import { createErrorResponse, createSuccessResponse } from '@/lib/middleware';
import { handleOptions } from '@/lib/cors';
import { CreateBookingDto } from '@/types';
import { z } from 'zod';

const createMultipleBookingsSchema = z.object({
  bookings: z.array(z.object({
    phone_number: z.string().min(1),
    doctor_id: z.union([z.string(), z.number()]).optional(),
    doctor_id: z.union([z.string(), z.number()]).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
    client_name: z.string().optional(),
  })).min(1),
});

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

// Создание множественных бронирований
export async function POST(request: NextRequest) {
  try {
    const body: any = await request.json();

    // Валидация
    const validation = createMultipleBookingsSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse('Noto\'g\'ri so\'rov', 400, request);
    }

    const bookingService = new BookingService();
    const results = [];

    for (const bookingData of validation.data.bookings) {
      try {
        const doctorId = bookingData.doctor_id ?? bookingData.doctor_id;
        const booking: CreateBookingDto = {
          phone_number: bookingData.phone_number,
          doctor_id: doctorId !== undefined ? String(doctorId) : undefined,
          date: bookingData.date,
          time: bookingData.time,
          client_name: bookingData.client_name,
        };

        const created = await bookingService.create(booking);
        results.push({ success: true, booking: created });
      } catch (error: any) {
        results.push({
          success: false,
          error: error.message || 'Xatolik yuz berdi',
          bookingData
        });
      }
    }

    return createSuccessResponse({ results }, 201, request);
  } catch (error: any) {
    return createErrorResponse(error.message || 'Xatolik yuz berdi', 400, request);
  }
}

