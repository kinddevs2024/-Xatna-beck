import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/lib/services/user.service';
import { authMiddleware, createErrorResponse, createSuccessResponse, roleMiddleware } from '@/lib/middleware';
import { handleOptions } from '@/lib/cors';
import { UserRole } from '@/types';

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function GET(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    if (user instanceof NextResponse) {
      return user;
    }

    // Проверка роли
    if (!roleMiddleware([UserRole.ADMIN, UserRole.SUPER_ADMIN])(user)) {
      return createErrorResponse('Ruxsat yo\'q', 403, request);
    }

    const userService = new UserService();
    const users = await userService.findAll();

    // Убрать пароли из ответа
    const usersWithoutPasswords = users.map(({ password, ...user }) => user);

    return createSuccessResponse(usersWithoutPasswords, 200, request);
  } catch (error: any) {
    return createErrorResponse(error.message || 'Xatolik yuz berdi', 500, request);
  }
}
