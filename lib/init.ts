import { prisma } from './db';
import { hashPassword } from './password';
import { UserRole } from '@/types';

// Helper function to retry database operations with exponential backoff
async function retryDatabaseOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T | null> {
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // Don't retry on non-authentication errors
      if (!error.message?.includes('authentication') && !error.message?.includes('SCRAM')) {
        throw error;
      }

      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt - 1);
        console.log(`[Init] ⚠️ Retry attempt ${attempt}/${maxRetries} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.error('[Init] ❌ Database operation failed after retries:', lastError?.message);
  return null;
}

export async function initializeDatabase() {
  // НЕ инициализируем Telegram бота здесь - это делается в server-init.ts
  // чтобы избежать проблем с Edge Runtime

  try {
    console.log('[Init] 🔄 Starting database initialization...');

    // Создать SUPER_ADMIN если не существует
    const existingSuperAdmin = await retryDatabaseOperation(
      () => prisma.user.findFirst({
        where: { role: UserRole.SUPER_ADMIN },
      })
    );

    if (!existingSuperAdmin) {
      const superAdminUsername = process.env.SUPER_ADMIN_USERNAME || 'super_admin';
      const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'super_admin123';
      const superAdminName = process.env.SUPER_ADMIN_NAME || 'Super Admin';
      const superAdminPhone = process.env.SUPER_ADMIN_PHONE || '+998900000000';

      const hashedPassword = await hashPassword(superAdminPassword);

      const created = await retryDatabaseOperation(
        () => prisma.user.create({
          data: {
            name: superAdminName,
            tg_username: superAdminUsername,
            phone_number: superAdminPhone,
            password: hashedPassword,
            role: UserRole.SUPER_ADMIN,
          },
        })
      );

      if (created) {
        console.log('[Init] ✅ SUPER_ADMIN muvaffaqiyatli yaratildi');
        console.log(`[Init] 📝 Username: ${superAdminUsername}`);
        console.log(`[Init] 🔑 Password: ${superAdminPassword}`);
      }
    } else {
      console.log('[Init] ✅ SUPER_ADMIN allaqachon mavjud');
    }

    // Создать доктора Xusanbek если не существует
    const existingXusanbek = await retryDatabaseOperation(
      () => prisma.user.findFirst({
        where: {
          OR: [
            { tg_id: '6329669015' },
            { tg_username: 'sunnat_xatna_uz' },
            { phone_number: '+998970335517' },
            { name: 'Xusanbek' },
            { name: 'xusanbek' },
          ],
        },
      })
    );

    if (!existingXusanbek) {
      const created = await retryDatabaseOperation(
        () => prisma.user.create({
          data: {
            name: 'Xusanbek',
            phone_number: '+998970335517',
            tg_id: '6329669015',
            tg_username: 'sunnat_xatna_uz',
            role: UserRole.DOCTOR,
            working: true,
            work_start_time: '09:00',
            work_end_time: '18:00',
            profile_image: '/uploads/xusanbek.jpg',
          },
        })
      );

      if (created) {
        console.log('[Init] ✅ Doktor Xusanbek muvaffaqiyatli yaratildi');
      }
    } else {
      await retryDatabaseOperation(
        () => prisma.user.update({
          where: { id: existingXusanbek.id },
          data: {
            name: 'Xusanbek',
            phone_number: '+998970335517',
            tg_id: '6329669015',
            tg_username: 'sunnat_xatna_uz',
            role: UserRole.DOCTOR,
            working: true,
            work_start_time: '09:00',
            work_end_time: '18:00',
            profile_image: '/uploads/xusanbek.jpg',
          },
        })
      );
      console.log('[Init] ✅ Doktor Xusanbek allaqachon mavjud');
    }

    // Создать default DOCTOR если не существует (только если нет других докторов)
    const existingDoctor = await retryDatabaseOperation(
      () => prisma.user.findFirst({
        where: { role: UserRole.DOCTOR },
      })
    );

    if (!existingDoctor) {
      const created = await retryDatabaseOperation(
        () => prisma.user.create({
          data: {
            name: 'Doktor',
            phone_number: '+998900000001',
            role: UserRole.DOCTOR,
            working: true,
            work_start_time: '09:00',
            work_end_time: '18:00',
          },
        })
      );

      if (created) {
        console.log('[Init] ✅ Default DOCTOR muvaffaqiyatli yaratildi');
      }
    } else {
      console.log('[Init] ✅ DOCTOR allaqachon mavjud');
    }

    console.log('[Init] ✅ Database initialization completed');
  } catch (error) {
    console.error('[Init] ❌ Xatolik:', error);
  }
}
