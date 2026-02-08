import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/lib/services/user.service';
import { authMiddleware, createErrorResponse, createSuccessResponse } from '@/lib/middleware';
import { handleOptions } from '@/lib/cors';
import { UserRole } from '@/types';

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function GET(request: NextRequest) {
  try {
    // Публичный endpoint - не требует авторизации для получения списка докторов
    const userService = new UserService();
    // Получить всех докторов (для совместимости с фронтендом, который ожидает барберов)
    const doctors = await userService.findByRole(UserRole.DOCTOR);

    // Убрать пароли из ответа
    const doctorsWithoutPasswords = doctors.map(({ password, ...doctor }) => doctor);

    return createSuccessResponse(doctorsWithoutPasswords, 200, request);
  } catch (error: any) {
    console.error('Error in GET /users/doctors:', error);
    return createErrorResponse(error.message || 'Xatolik yuz berdi', 500, request);
  }
}
