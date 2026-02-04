import { NextRequest, NextResponse } from 'next/server';
import { BookingService } from '@/lib/services/booking.service';
import { createErrorResponse, createSuccessResponse } from '@/lib/middleware';
import { handleOptions } from '@/lib/cors';
import { UserService } from '@/lib/services/user.service';
import { UserRole } from '@/types';
import { z } from 'zod';

const getAvailableSlotsSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  doctor_id: z.union([z.string(), z.number()]).optional(),
  barber_id: z.union([z.string(), z.number()]).optional(), // Для совместимости с фронтендом
});

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const doctorIdParam = searchParams.get('doctor_id');
    const barberIdParam = searchParams.get('barber_id');

    // Нормализация данных
    let doctorId: string | undefined;
    if (doctorIdParam) {
      doctorId = String(doctorIdParam).trim();
    }
    if (!doctorId && barberIdParam) {
      doctorId = String(barberIdParam).trim();
    }

    // Валидация
    const validation = getAvailableSlotsSchema.safeParse({
      date: date || '',
      doctor_id: doctorId,
      barber_id: doctorId,
    });

    if (!validation.success) {
      return createErrorResponse('Noto\'g\'ri so\'rov. Sana va doctor_id/barber_id kerak.', 400, request);
    }

    if (!date) {
      return createErrorResponse('Sana talab qilinadi', 400, request);
    }

    // Найти доктора
    const userService = new UserService();
    let doctor;
    
    if (doctorId) {
      doctor = await userService.findOne(doctorId);
      if (!doctor || String(doctor.role).toUpperCase() !== UserRole.DOCTOR) {
        // Если указанный доктор не найден, используем default
        doctor = await userService.findDefaultDoctor();
      }
    } else {
      doctor = await userService.findDefaultDoctor();
    }

    if (!doctor) {
      return createErrorResponse('Doktor topilmadi', 404, request);
    }

    // Получить рабочие часы доктора
    const workStart = doctor.work_start_time || '09:00';
    const workEnd = doctor.work_end_time || '18:00';
    
    const [startHour, startMinute] = workStart.split(':').map(Number);
    const [endHour, endMinute] = workEnd.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    // Генерируем все возможные 30-минутные слоты в рабочее время
    const allSlots: string[] = [];
    for (let minutes = startMinutes; minutes < endMinutes; minutes += 30) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      allSlots.push(`${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`);
    }

    // Получить забронированные времена для этой даты
    const bookingService = new BookingService();
    const bookings = await bookingService.findByDoctorId(doctor.id);
    
    // Фильтруем бронирования по дате и активным статусам
    const bookedTimes = bookings
      .filter(b => {
        const bookingDate = b.date;
        const bookingStatus = String(b.status).toUpperCase();
        return bookingDate === date && 
               (bookingStatus === 'PENDING' || bookingStatus === 'APPROVED');
      })
      .map(b => b.time)
      .filter(Boolean);
    
    console.log(`[GET /bookings/available-slots] Date: ${date}, Doctor: ${doctor.id}, Booked times:`, bookedTimes);

    // Фильтруем доступные слоты (убираем забронированные и прошедшие времена)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDateObj = new Date(date);
    selectedDateObj.setHours(0, 0, 0, 0);
    const isToday = selectedDateObj.getTime() === today.getTime();
    
    // Текущее время в минутах (если выбран сегодня)
    const now = new Date();
    const currentTimeMinutes = isToday ? now.getHours() * 60 + now.getMinutes() : -1;

    const availableSlots = allSlots.filter(slot => {
      const [slotHour, slotMinute] = slot.split(':').map(Number);
      const slotStartMinutes = slotHour * 60 + slotMinute;
      
      // Если выбран сегодня, фильтруем прошедшие времена
      if (isToday && currentTimeMinutes >= 0) {
        // Оставляем только времена, которые еще не прошли (блокируем прошедшие времена)
        // Не добавляем запас, так как пользователь может забронировать ближайший доступный слот
        if (slotStartMinutes <= currentTimeMinutes) {
          return false;
        }
      }
      
      // Проверяем, не пересекается ли слот с забронированными временами
      const slotEndMinutes = slotStartMinutes + 30; // 30 минут длительность

      return !bookedTimes.some(bookedTime => {
        if (!bookedTime) return false;
        const [bookedHour, bookedMinute] = bookedTime.split(':').map(Number);
        const bookedStartMinutes = bookedHour * 60 + bookedMinute;
        const bookedEndMinutes = bookedStartMinutes + 30;

        // Проверяем пересечение
        return !(slotEndMinutes <= bookedStartMinutes || slotStartMinutes >= bookedEndMinutes);
      });
    });

    return createSuccessResponse({
      date,
      doctor_id: doctor.id,
      doctor_name: doctor.name,
      work_start_time: workStart,
      work_end_time: workEnd,
      available_slots: availableSlots,
      booked_slots: bookedTimes,
    }, 200, request);
  } catch (error: any) {
    console.error('[GET /bookings/available-slots] Error:', error);
    return createErrorResponse(error.message || 'Xatolik yuz berdi', 500, request);
  }
}

