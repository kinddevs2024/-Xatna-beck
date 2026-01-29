import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/lib/services/user.service';
import { authMiddleware, createErrorResponse, createSuccessResponse, roleMiddleware } from '@/lib/middleware';
import { handleOptions } from '@/lib/cors';
import { UserRole } from '@/types';
import { z } from 'zod';
import { prisma } from '@/lib/db';

const updateRoleSchema = z.object({
  role: z.string(), // SQLite использует строки вместо enum
});

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authMiddleware(request);
    if (user instanceof NextResponse) {
      return user;
    }

    // Проверка роли
    if (!roleMiddleware([UserRole.ADMIN, UserRole.SUPER_ADMIN])(user)) {
      return createErrorResponse('Ruxsat yo\'q', 403, request);
    }

    const userId = parseInt(params.id);
    if (isNaN(userId)) {
      return createErrorResponse("Noto'g'ri foydalanuvchi ID format", 400, request);
    }

    let body;
    try {
      const text = await request.text();
      const trimmedText = text?.trim() || '';
      
      // Проверяем на пустое тело или невалидные значения
      if (!trimmedText || trimmedText === '' || trimmedText === '-' || trimmedText === 'null' || trimmedText === 'undefined') {
        return createErrorResponse('Bo\'sh so\'rov. Iltimos, role maydonini yuboring: {"role": "CLIENT"}', 400, request);
      }
      
      // Проверяем, что это валидный JSON (начинается с { или [)
      if (!trimmedText.startsWith('{') && !trimmedText.startsWith('[')) {
        return createErrorResponse('Noto\'g\'ri JSON format. Iltimos, {"role": "CLIENT"} formatida yuboring', 400, request);
      }
      
      body = JSON.parse(trimmedText);
      
      // Проверяем, что body это объект
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return createErrorResponse('Noto\'g\'ri so\'rov formati. Iltimos, {"role": "CLIENT"} formatida yuboring', 400, request);
      }
    } catch (error: any) {
      console.error('Error parsing JSON:', error);
      if (error instanceof SyntaxError) {
        return createErrorResponse(`Noto'g'ri JSON format: ${error.message}. Iltimos, {"role": "CLIENT"} formatida yuboring`, 400, request);
      }
      return createErrorResponse('Noto\'g\'ri JSON format', 400, request);
    }

    const validation = updateRoleSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse('Noto\'g\'ri so\'rov', 400, request);
    }

    // Преобразовать строку в верхний регистр для совместимости
    const roleStr = validation.data.role.toUpperCase();
    let roleValue: string;
    
    if (roleStr === 'ADMIN') roleValue = UserRole.ADMIN;
    else if (roleStr === 'DOCTOR') roleValue = UserRole.DOCTOR;
    else if (roleStr === 'CLIENT') roleValue = UserRole.CLIENT;
    else if (roleStr === 'SUPER_ADMIN') roleValue = UserRole.SUPER_ADMIN;
    else {
      return createErrorResponse(`Invalid role: ${validation.data.role}. Must be one of: ADMIN, DOCTOR, CLIENT, SUPER_ADMIN`, 400, request);
    }

    const userService = new UserService();
    const targetUser = await userService.findOne(userId);

    if (!targetUser) {
      return createErrorResponse(`ID ${userId} bilan foydalanuvchi topilmadi`, 404, request);
    }

    // O'z rolini o'zgartirish mumkin emas
    if (user.id === userId) {
      return createErrorResponse('O\'z rolingizni o\'zgartirib bo\'lmaydi. Boshqa admin yordamidan foydalaning', 403, request);
    }

    // ADMIN faqat DOCTOR va CLIENT rollarini o'zgartirishi mumkin
    const userRoleStr = String(user.role).toUpperCase();
    if (userRoleStr === 'ADMIN') {
      const targetRoleStr = String(targetUser.role).toUpperCase();
      if (targetRoleStr === 'ADMIN' || targetRoleStr === 'SUPER_ADMIN') {
        return createErrorResponse('ADMIN faqat DOCTOR va CLIENT rollarini o\'zgartirishi mumkin', 403, request);
      }

      if (roleValue !== UserRole.DOCTOR && roleValue !== UserRole.CLIENT) {
        return createErrorResponse('ADMIN foydalanuvchini faqat DOCTOR yoki CLIENT rollariga o\'zgartira oladi', 403, request);
      }
    }

    // Обновить роль (roleValue это строка, как и в схеме)
    try {
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { role: roleValue },
      });

      const { password, ...userWithoutPassword } = updatedUser;
      return createSuccessResponse(userWithoutPassword, 200, request);
    } catch (dbError: any) {
      console.error('Database error updating role:', dbError);
      return createErrorResponse(dbError.message || 'Ma\'lumotlar bazasida xatolik', 500, request);
    }
  } catch (error: any) {
    console.error('Error in PATCH /users/[id]/role:', error);
    return createErrorResponse(error.message || 'Xatolik yuz berdi', 500, request);
  }
}
