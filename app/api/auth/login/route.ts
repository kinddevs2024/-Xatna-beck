import { NextRequest } from 'next/server';
import { UserService } from '@/lib/services/user.service';
import { comparePassword, generateToken } from '@/lib/auth';
import { createErrorResponse, createSuccessResponse } from '@/lib/middleware';
import { handleOptions } from '@/lib/cors';
import { UserRole } from '@/types';
import { z } from 'zod';
import { initializeServer } from '@/lib/server-init';
import { autoInitializeTelegramBot } from '@/lib/telegram-auto-init';

// Инициализируем сервер при первом запросе
initializeServer().catch(console.error);

// Также пытаемся инициализировать Telegram бота
if (process.env.BOT_TOKEN) {
  autoInitializeTelegramBot().catch(console.error);
}

const loginSchema = z.object({
  tg_username: z.string().min(1),
  password: z.string().min(1),
});

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = loginSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse('Noto\'g\'ri so\'rov', 400, request);
    }

    const { tg_username, password } = validation.data;
    const userService = new UserService();
    const user = await userService.findByTgUsername(tg_username);

    if (!user) {
      return createErrorResponse(`Bu tg_username (${tg_username}) bilan foydalanuvchi topilmadi`, 400, request);
    }

    console.log('[Login] User found:', JSON.stringify({
      id: user.id,
      name: user.name,
      role: user.role,
      tg_username: user.tg_username,
    }));

    // Faqat admin va super_admin API orqali login qilishi mumkin
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      return createErrorResponse('API orqali faqat admin yoki super_admin login qilishi mumkin', 400, request);
    }

    if (!user.password) {
      return createErrorResponse("Foydalanuvchida parol o'rnatilmagan", 400, request);
    }

    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      return createErrorResponse("Noto'g'ri parol", 400, request);
    }

    const token = generateToken({ id: user.id, role: user.role });
    console.log('[Login] Token generated for user:', user.id, 'with role:', user.role);
    const { password: _, ...userWithoutPassword } = user;

    return createSuccessResponse({ token, user: userWithoutPassword }, 200, request);
  } catch (error: any) {
    return createErrorResponse(error.message || 'Xatolik yuz berdi', 500, request);
  }
}
