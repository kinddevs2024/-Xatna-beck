import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/lib/services/user.service';
import { authMiddleware, createErrorResponse, createSuccessResponse } from '@/lib/middleware';
import { handleOptions } from '@/lib/cors';
import { z } from 'zod';

const updateClientSchema = z.object({
  name: z.string().optional(),
  phone_number: z.string().optional(),
  tg_username: z.string().optional(),
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

    const userId = params.id;
    if (!userId) {
      return createErrorResponse("Noto'g'ri ID format", 400, request);
    }

    // Клиент может обновить только свои данные, админы могут обновлять любых клиентов
    const userRoleStr = String(user.role).toUpperCase();
    if (userRoleStr !== 'ADMIN' && userRoleStr !== 'SUPER_ADMIN' && user.id !== userId) {
      return createErrorResponse('Siz faqat o\'z ma\'lumotlaringizni yangilay olasiz', 403, request);
    }

    const body = await request.json();
    const validation = updateClientSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse('Noto\'g\'ri so\'rov', 400, request);
    }

    const userService = new UserService();
    const foundUser = await userService.findOne(userId);

    if (!foundUser) {
      return createErrorResponse('Foydalanuvchi topilmadi', 404, request);
    }

    // Обновить данные
    try {
      const updatedUser = await userService.update(userId, validation.data);
      const { password, ...userWithoutPassword } = updatedUser;
      return createSuccessResponse(userWithoutPassword, 200, request);
    } catch (updateError: any) {
      console.error('Error updating user:', updateError);
      return createErrorResponse(updateError.message || 'Foydalanuvchini yangilashda xatolik', 500, request);
    }
  } catch (error: any) {
    console.error('Error in PATCH /client/[id]:', error);
    return createErrorResponse(error.message || 'Xatolik yuz berdi', 500, request);
  }
}
