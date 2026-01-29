import { prisma } from './db';
import { hashPassword } from './auth';
import { UserRole } from '@/types';

// Инициализируем Telegram бота при импорте модуля
let telegramBotInitialized = false;
export function initializeTelegramBot() {
  if (telegramBotInitialized) return;
  
  try {
    // Импортируем сервис, что запустит конструктор и polling
    // Используем динамический импорт, чтобы избежать проблем с циклическими зависимостями
    import('./services/telegram.service').then((module) => {
      telegramBotInitialized = true;
      // Бот уже инициализирован в конструкторе, просто логируем
      const isInitialized = module.telegramService.isInitialized();
      if (isInitialized) {
        console.log('[Init] ✅ Telegram Bot модуль загружен и инициализирован');
      } else {
        console.warn('[Init] ⚠️ Telegram Bot модуль загружен, но не инициализирован');
      }
    }).catch((error) => {
      console.error('[Init] ❌ Ошибка инициализации Telegram Bot:', error);
    });
  } catch (error) {
    console.error('[Init] ❌ Ошибка импорта Telegram Bot:', error);
  }
}

export async function initializeDatabase() {
  // НЕ инициализируем Telegram бота здесь - это делается в server-init.ts
  // чтобы избежать проблем с Edge Runtime
  
  try {
    // Создать SUPER_ADMIN если не существует
    const existingSuperAdmin = await prisma.user.findFirst({
      where: { role: UserRole.SUPER_ADMIN },
    });

    if (!existingSuperAdmin) {
      const superAdminUsername = process.env.SUPER_ADMIN_USERNAME || 'super_admin';
      const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'super_admin123';
      const superAdminName = process.env.SUPER_ADMIN_NAME || 'Super Admin';
      const superAdminPhone = process.env.SUPER_ADMIN_PHONE || '+998900000000';

      const hashedPassword = await hashPassword(superAdminPassword);

      await prisma.user.create({
        data: {
          name: superAdminName,
          tg_username: superAdminUsername,
          phone_number: superAdminPhone,
          password: hashedPassword,
          role: UserRole.SUPER_ADMIN,
        },
      });

      console.log('[Init] ✅ SUPER_ADMIN muvaffaqiyatli yaratildi');
      console.log(`[Init] 📝 Username: ${superAdminUsername}`);
      console.log(`[Init] 🔑 Password: ${superAdminPassword}`);
    } else {
      console.log('[Init] ✅ SUPER_ADMIN allaqachon mavjud');
    }

    // Создать доктора Xusanbek если не существует
    const existingXusanbek = await prisma.user.findFirst({
      where: { 
        role: UserRole.DOCTOR,
        name: 'Xusanbek'
      },
    });

    if (!existingXusanbek) {
      await prisma.user.create({
        data: {
          name: 'Xusanbek',
          phone_number: '+998970335517',
          tg_username: 'sunnat_xatna_uz',
          role: UserRole.DOCTOR,
          working: true,
          work_start_time: '09:00',
          work_end_time: '18:00',
          profile_image: '/uploads/xusanbek.jpg',
        },
      });

      console.log('[Init] ✅ Doktor Xusanbek muvaffaqiyatli yaratildi');
    } else {
      console.log('[Init] ✅ Doktor Xusanbek allaqachon mavjud');
    }

    // Создать default DOCTOR если не существует (только если нет других докторов)
    const existingDoctor = await prisma.user.findFirst({
      where: { role: UserRole.DOCTOR },
    });

    if (!existingDoctor) {
      await prisma.user.create({
        data: {
          name: 'Doktor',
          phone_number: '+998900000001',
          role: UserRole.DOCTOR,
          working: true,
          work_start_time: '09:00',
          work_end_time: '18:00',
        },
      });

      console.log('[Init] ✅ Default DOCTOR muvaffaqiyatli yaratildi');
    } else {
      console.log('[Init] ✅ DOCTOR allaqachon mavjud');
    }
  } catch (error) {
    console.error('[Init] ❌ Xatolik:', error);
  }
}
