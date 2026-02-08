import { prisma } from '@/lib/db';
import { Booking, BookingStatus, CreateBookingDto, UserRole } from '@/types';
import { UserService } from './user.service';

const APPOINTMENT_DURATION_MINUTES = 30; // Фиксированная длительность 30 минут

export class BookingService {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  async create(createBookingDto: CreateBookingDto & { client_id?: string }): Promise<Booking> {
    const { phone_number, client_name, date, time, client_id } = createBookingDto;

    // Найти или создать default доктора
    let doctor = await this.userService.findDefaultDoctor();
    if (!doctor) {
      throw new Error('Doktor topilmadi. Iltimos, avval doktor yarating.');
    }

    // Если doctor_id указан, попытаться использовать его
    if (createBookingDto.doctor_id) {
      try {
        const specifiedDoctor = await this.userService.findOne(createBookingDto.doctor_id);

        // Проверяем, что доктор найден и имеет правильную роль
        if (specifiedDoctor) {
          const doctorRole = String(specifiedDoctor.role).toUpperCase();
          if (doctorRole === UserRole.DOCTOR || doctorRole === 'DOCTOR') {
            doctor = specifiedDoctor;
            console.log(`[BookingService] Using specified doctor ID ${createBookingDto.doctor_id}: ${doctor.name}`);
          } else {
            console.warn(`[BookingService] User ID ${createBookingDto.doctor_id} exists but has role ${specifiedDoctor.role}, not DOCTOR. Using default doctor.`);
          }
        } else {
          console.warn(`[BookingService] Doctor ID ${createBookingDto.doctor_id} not found. Using default doctor.`);
        }
      } catch (error: any) {
        console.warn(`[BookingService] Error finding doctor ID ${createBookingDto.doctor_id}:`, error.message);
        console.log(`[BookingService] Falling back to default doctor.`);
        // Продолжаем с default доктором
      }
    }

    if (!doctor) {
      throw new Error('Doktor topilmadi. Iltimos, avval doktor yarating.');
    }

    // Проверяем, что доктор действительно имеет роль DOCTOR
    const doctorRole = String(doctor.role).toUpperCase();
    if (doctorRole !== UserRole.DOCTOR && doctorRole !== 'DOCTOR') {
      console.error(`[BookingService] Default doctor has wrong role: ${doctor.role}, expected DOCTOR`);
      throw new Error('Doktor roli noto\'g\'ri. Iltimos, doktor yarating.');
    }

    console.log(`[BookingService] Using doctor: ID=${doctor.id}, Name=${doctor.name}, Role=${doctor.role}`);

    // Проверить доступность слота (30 минут)
    const isSlotFree = await this.checkTimeSlotAvailability(
      doctor.id,
      date,
      time,
      APPOINTMENT_DURATION_MINUTES,
    );

    if (!isSlotFree) {
      // Проверяем причину недоступности для более точного сообщения
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selectedDate = new Date(date);
      selectedDate.setHours(0, 0, 0, 0);
      const isToday = selectedDate.getTime() === today.getTime();

      if (selectedDate < today) {
        throw new Error('O\'tgan sanani tanlash mumkin emas');
      }

      if (isToday) {
        const now = new Date();
        const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();
        const [hours, minutes] = time.split(':').map(Number);
        const slotTimeMinutes = hours * 60 + minutes;

        if (slotTimeMinutes <= currentTimeMinutes) {
          throw new Error('O\'tgan vaqtni tanlash mumkin emas');
        }
      }

      throw new Error('Tanlangan vaqt allaqachon band. Boshqa vaqtni tanlang');
    }

    // Найти или создать клиента
    let client;

    // Если client_id указан явно (например, из Telegram бота), используем его
    if (client_id) {
      client = await this.userService.findOne(client_id);
      if (!client) {
        throw new Error(`Mijoz ID ${client_id} topilmadi`);
      }
      // Обновляем имя если указано
      if (client_name && client.name !== client_name) {
        await this.userService.update(client.id, { name: client_name });
        client.name = client_name;
      }
      // Обновляем телефон если указан и отличается
      if (phone_number && client.phone_number !== phone_number) {
        await this.userService.update(client.id, { phone_number });
        client.phone_number = phone_number;
      }
    } else {
      // Стандартная логика: ищем по телефону
      client = await this.userService.findByPhoneNumber(phone_number);

      if (client) {
        if (client.tg_id && client_name && client.name !== client_name) {
          await this.userService.update(client.id, { name: client_name });
          client.name = client_name;
        }
      } else {
        try {
          client = await this.userService.create({
            phone_number,
            role: UserRole.CLIENT,
            name: client_name,
          });
        } catch (error: any) {
          if (error?.message?.includes('allaqachon mavjud')) {
            client = await this.userService.findByPhoneNumber(phone_number);
            if (!client) {
              throw new Error('Foydalanuvchi yaratishda xatolik yuz berdi');
            }
            if (client_name && client.name !== client_name) {
              await this.userService.update(client.id, { name: client_name });
              client.name = client_name;
            }
          } else {
            throw error;
          }
        }
      }
    }

    if (!client || !client.id) {
      throw new Error("Mijoz ma'lumotlari topilmadi");
    }

    // Создать booking (30 минут)
    const booking = await prisma.booking.create({
      data: {
        client_id: client.id,
        doctor_id: doctor.id,
        date,
        time,
        status: BookingStatus.PENDING,
      },
      include: {
        client: true,
        doctor: true,
      },
    });

    // Отправить уведомление клиенту через Telegram, если у него есть tg_id
    if (booking.client?.tg_id) {
      try {
        const { telegramService } = await import('@/lib/services/telegram.service');
        await telegramService.sendBookingNotification(
          booking.client.tg_id,
          {
            date: booking.date,
            time: booking.time,
            doctorName: booking.doctor?.name || 'Shifokor',
            status: booking.status,
          }
        );
      } catch (error) {
        console.error('Error sending booking notification:', error);
        // Не прерываем выполнение, если уведомление не отправилось
      }
    }

    return booking as Booking;
  }

  async checkTimeSlotAvailability(
    doctorId: string,
    date: string,
    time: string,
    duration: number,
  ): Promise<boolean> {
    if (!doctorId || String(doctorId).trim() === '') {
      throw new Error("Noto'g'ri doktor ID format");
    }

    if (!date || !time) {
      throw new Error('Sana va vaqt berilishi kerak');
    }

    const timeParts = time.split(':');
    if (timeParts.length !== 2) {
      throw new Error("Vaqt formati noto'g'ri (HH:mm bo'lishi kerak)");
    }

    const [hours, minutes] = timeParts.map(Number);
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      throw new Error("Noto'g'ri vaqt formati");
    }

    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + duration;

    // Проверить, что время не в прошлом (если дата - сегодня)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);
    const isToday = selectedDate.getTime() === today.getTime();

    if (isToday) {
      const now = new Date();
      const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();
      // Блокируем времена, которые уже прошли (с запасом 30 минут для безопасности)
      if (startMinutes <= currentTimeMinutes) {
        return false;
      }
    }

    // Проверить, что дата не в прошлом
    if (selectedDate < today) {
      return false;
    }

    // Проверить рабочие часы доктора
    const doctor = await prisma.user.findUnique({
      where: { id: doctorId },
      select: { work_start_time: true, work_end_time: true },
    });

    if (doctor?.work_start_time && doctor?.work_end_time) {
      const [startHour, startMinute] = doctor.work_start_time.split(':').map(Number);
      const [endHour, endMinute] = doctor.work_end_time.split(':').map(Number);

      if ([startHour, startMinute, endHour, endMinute].some((value) => isNaN(value))) {
        throw new Error("Doktor ish vaqti noto'g'ri formatda (HH:mm)");
      }

      const workStartMinutes = startHour * 60 + startMinute;
      const workEndMinutes = endHour * 60 + endMinute;

      if (startMinutes < workStartMinutes || endMinutes > workEndMinutes) {
        return false;
      }
    }

    // Проверить пересечения с существующими бронированиями (30-минутные слоты)
    const bookings = await prisma.booking.findMany({
      where: {
        doctor_id: doctorId,
        date,
        status: {
          in: [BookingStatus.PENDING, BookingStatus.APPROVED],
        },
      },
    });

    for (const booking of bookings) {
      if (!booking.time) continue;

      const bookingTimeParts = booking.time.split(':');
      if (bookingTimeParts.length !== 2) continue;

      const [bookingHours, bookingMinutes] = bookingTimeParts.map(Number);
      if (isNaN(bookingHours) || isNaN(bookingMinutes)) continue;

      const bookingStartMinutes = bookingHours * 60 + bookingMinutes;
      const bookingEndMinutes = bookingStartMinutes + APPOINTMENT_DURATION_MINUTES; // Всегда 30 минут

      // Проверить пересечения: если слоты перекрываются, то недоступен
      // Два слота перекрываются, если:
      // - начало нового слота внутри существующего: startMinutes >= bookingStartMinutes && startMinutes < bookingEndMinutes
      // - конец нового слота внутри существующего: endMinutes > bookingStartMinutes && endMinutes <= bookingEndMinutes
      // - новый слот полностью содержит существующий: startMinutes <= bookingStartMinutes && endMinutes >= bookingEndMinutes
      if (
        (startMinutes >= bookingStartMinutes && startMinutes < bookingEndMinutes) ||
        (endMinutes > bookingStartMinutes && endMinutes <= bookingEndMinutes) ||
        (startMinutes <= bookingStartMinutes && endMinutes >= bookingEndMinutes)
      ) {
        return false; // Слот занят
      }
    }

    return true;
  }

  async findAll(): Promise<Booking[]> {
    const bookings = await prisma.booking.findMany({
      include: {
        client: true,
        doctor: true,
      },
      orderBy: { created_at: 'desc' },
    });
    return bookings as Booking[];
  }

  async findOne(id: string): Promise<Booking | null> {
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        client: true,
        doctor: true,
      },
    });
    return booking as Booking | null;
  }

  async findByDoctorId(doctorId: string): Promise<Booking[]> {
    const bookings = await prisma.booking.findMany({
      where: { doctor_id: doctorId },
      include: {
        client: true,
      },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
    });
    return bookings as Booking[];
  }

  async findByClientId(clientId: string): Promise<Booking[]> {
    const bookings = await prisma.booking.findMany({
      where: { client_id: clientId },
      include: {
        doctor: true,
      },
      orderBy: [{ date: 'desc' }, { time: 'desc' }],
    });
    return bookings as Booking[];
  }

  async findPendingBookings(): Promise<Booking[]> {
    const bookings = await prisma.booking.findMany({
      where: { status: BookingStatus.PENDING },
      include: {
        client: true,
        doctor: true,
      },
      orderBy: { created_at: 'asc' },
    });
    return bookings as Booking[];
  }

  async updateStatus(id: string, status: BookingStatus): Promise<Booking> {
    // Получить текущее бронирование для сохранения старого статуса
    const oldBooking = await prisma.booking.findUnique({
      where: { id },
      include: {
        client: true,
        doctor: true,
      },
    });

    if (!oldBooking) {
      throw new Error('Bron topilmadi');
    }

    const oldStatus = oldBooking.status;

    // Обновить статус
    const booking = await prisma.booking.update({
      where: { id },
      data: { status },
      include: {
        client: true,
        doctor: true,
      },
    });

    // Отправить уведомление клиенту через Telegram, если статус изменился и у клиента есть tg_id
    if (booking.client?.tg_id && oldStatus !== status) {
      try {
        const { telegramService } = await import('@/lib/services/telegram.service');
        await telegramService.sendBookingStatusUpdate(
          booking.client.tg_id,
          {
            date: booking.date,
            time: booking.time,
            doctorName: booking.doctor?.name || 'Shifokor',
            oldStatus: oldStatus,
            newStatus: status,
          }
        );
      } catch (error) {
        console.error('Error sending booking status update notification:', error);
        // Не прерываем выполнение, если уведомление не отправилось
      }
    }

    return booking as Booking;
  }

  async remove(id: string): Promise<void> {
    await prisma.booking.delete({
      where: { id },
    });
  }

  async getStatistics(startDate: string, endDate: string) {
    // Фиксированная цена за бронирование (30 минут)
    const FIXED_SERVICE_PRICE = parseFloat(process.env.FIXED_SERVICE_PRICE || '50000');

    const bookings = await prisma.booking.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        client: true,
        doctor: true,
      },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
    });

    const totalBookings = bookings.length;

    // Подсчет бронирований по статусам (статусы хранятся как строки в SQLite)
    const bookingsByStatus = {
      pending: bookings.filter((b) => String(b.status).toUpperCase() === BookingStatus.PENDING).length,
      approved: bookings.filter((b) => String(b.status).toUpperCase() === BookingStatus.APPROVED).length,
      rejected: bookings.filter((b) => String(b.status).toUpperCase() === BookingStatus.REJECTED).length,
      cancelled: bookings.filter((b) => String(b.status).toUpperCase() === BookingStatus.CANCELLED).length,
      completed: bookings.filter((b) => String(b.status).toUpperCase() === BookingStatus.COMPLETED).length,
    };

    // Расчет дохода только от завершенных бронирований
    const completedBookings = bookings.filter((b) => String(b.status).toUpperCase() === BookingStatus.COMPLETED);
    const totalRevenue = completedBookings.length * FIXED_SERVICE_PRICE;

    // Группировка по докторам
    const doctorStatsMap = new Map<string, {
      doctor: any;
      bookings: any[];
    }>();

    bookings.forEach((booking) => {
      if (!booking.doctor_id || !booking.doctor) return;

      if (!doctorStatsMap.has(booking.doctor_id)) {
        doctorStatsMap.set(booking.doctor_id, {
          doctor: {
            id: booking.doctor.id,
            name: booking.doctor.name || 'N/A',
          },
          bookings: [],
        });
      }

      const doctorStat = doctorStatsMap.get(booking.doctor_id)!;

      // Создаем объект бронирования с фиктивной услугой (30 минут)
      const bookingWithService = {
        id: booking.id,
        date: booking.date,
        time: booking.time,
        status: booking.status,
        service: {
          id: 0,
          name: '30 daqiqa xizmat',
          price: FIXED_SERVICE_PRICE,
          duration: 30,
        },
        services: [{
          id: 0,
          name: '30 daqiqa xizmat',
          price: FIXED_SERVICE_PRICE,
          duration: 30,
        }],
      };

      doctorStat.bookings.push(bookingWithService);
    });

    // Преобразуем Map в массив
    const doctorStatistics = Array.from(doctorStatsMap.values());

    return {
      period: {
        start_date: startDate,
        end_date: endDate,
      },
      summary: {
        total_revenue: totalRevenue,
        total_bookings: totalBookings,
        bookings_by_status: bookingsByStatus,
      },
      doctor_statistics: doctorStatistics,
    };
  }
}
