import { NextRequest, NextResponse } from 'next/server';
import { BookingService } from '@/lib/services/booking.service';
import { authMiddleware, createErrorResponse, createSuccessResponse } from '@/lib/middleware';
import { handleOptions } from '@/lib/cors';
import { CreateBookingDto } from '@/types';
import { z } from 'zod';

// Схема для совместимости с фронтендом (принимает barber_id и service_ids, но игнорирует service_ids)
const createBookingSchema = z.object({
  phone_number: z.string().min(1),
  doctor_id: z.number().optional(),
  barber_id: z.number().optional(), // Для совместимости с фронтендом
  service_ids: z.array(z.number()).optional(), // Игнорируется, так как фиксированные 30 минут
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
  client_name: z.string().optional(),
});

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
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
    
    // Нормализация данных: конвертируем barber_id в число если нужно
    if (body.barber_id !== undefined && body.barber_id !== null && body.barber_id !== '') {
      const parsedBarberId = typeof body.barber_id === 'string' ? parseInt(body.barber_id, 10) : body.barber_id;
      body.barber_id = isNaN(parsedBarberId) ? undefined : parsedBarberId;
    } else {
      body.barber_id = undefined;
    }
    
    if (body.doctor_id !== undefined && body.doctor_id !== null && body.doctor_id !== '') {
      const parsedDoctorId = typeof body.doctor_id === 'string' ? parseInt(body.doctor_id, 10) : body.doctor_id;
      body.doctor_id = isNaN(parsedDoctorId) ? undefined : parsedDoctorId;
    } else {
      body.doctor_id = undefined;
    }
    
    // Нормализация phone_number - убираем пробелы
    if (body.phone_number) {
      body.phone_number = String(body.phone_number).trim();
    }
    
    // Нормализация date и time - убираем пробелы
    if (body.date) {
      body.date = String(body.date).trim();
    }
    if (body.time) {
      body.time = String(body.time).trim();
    }
    
    // Валидация
    const validation = createBookingSchema.safeParse(body);
    if (!validation.success) {
      console.error('[POST /bookings] Validation error:', validation.error.errors);
      return createErrorResponse(
        `Noto'g'ri so'rov: ${validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        400,
        request
      );
    }

    // Адаптировать для нашего API: barber_id -> doctor_id
    // Если barber_id/doctor_id не указан, будет использован default доктор в BookingService
    const doctorId = validation.data.doctor_id || validation.data.barber_id;
    
    // Проверяем, что если указан, то это валидное число
    if (doctorId !== undefined && (isNaN(doctorId) || doctorId <= 0)) {
      return createErrorResponse('Noto\'g\'ri doctor_id yoki barber_id format', 400, request);
    }

    const bookingData: CreateBookingDto = {
      phone_number: validation.data.phone_number,
      doctor_id: doctorId, // Может быть undefined - тогда используется default доктор
      date: validation.data.date,
      time: validation.data.time,
      client_name: validation.data.client_name,
    };

    console.log('[POST /bookings] Booking data:', JSON.stringify(bookingData, null, 2));

    const bookingService = new BookingService();
    const booking = await bookingService.create(bookingData);

    return createSuccessResponse(booking, 201, request);
  } catch (error: any) {
    console.error('[POST /bookings] Error:', error);
    return createErrorResponse(error.message || 'Xatolik yuz berdi', 400, request);
  }
}

export async function GET(request: NextRequest) {
  try {
    // Проверка аутентификации
    const user = await authMiddleware(request);
    if (user instanceof NextResponse) {
      return user; // Ошибка аутентификации
    }

    const bookingService = new BookingService();
    const bookings = await bookingService.findAll();

    return createSuccessResponse(bookings, 200, request);
  } catch (error: any) {
    return createErrorResponse(error.message || 'Xatolik yuz berdi', 500, request);
  }
}
