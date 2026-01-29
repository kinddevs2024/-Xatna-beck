import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/lib/services/user.service';
import { createErrorResponse, createSuccessResponse } from '@/lib/middleware';
import { handleOptions } from '@/lib/cors';
import { UserRole } from '@/types';
import { z } from 'zod';

const createClientSchema = z.object({
  name: z.string().min(1),
  phone_number: z.string().optional(),
  tg_username: z.string().optional(),
});

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

// Публичная регистрация клиента (без аутентификации)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = createClientSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse('Noto\'g\'ri so\'rov', 400, request);
    }

    const userService = new UserService();
    const client = await userService.create(
      {
        ...validation.data,
        role: UserRole.CLIENT,
      }
      // Без currentUser, так как это публичная регистрация
    );

    const { password, ...clientWithoutPassword } = client;
    return createSuccessResponse(clientWithoutPassword, 201, request);
  } catch (error: any) {
    return createErrorResponse(error.message || 'Xatolik yuz berdi', 400, request);
  }
}
