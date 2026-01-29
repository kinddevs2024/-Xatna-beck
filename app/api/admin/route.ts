import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/lib/services/user.service';
import { authMiddleware, createErrorResponse, createSuccessResponse, roleMiddleware } from '@/lib/middleware';
import { handleOptions } from '@/lib/cors';
import { UserRole } from '@/types';
import { z } from 'zod';

const createAdminSchema = z.object({
  name: z.string().min(1),
  tg_username: z.string().min(1),
  phone_number: z.string().optional(),
  password: z.string().min(4),
  profile_image: z.string().optional(),
});

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function POST(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    if (user instanceof NextResponse) {
      return user;
    }

    // Проверка роли - только SUPER_ADMIN может создавать админов
    if (!roleMiddleware([UserRole.SUPER_ADMIN])(user)) {
      return createErrorResponse('Ruxsat yo\'q', 403, request);
    }

    const body = await request.json();
    const validation = createAdminSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse('Noto\'g\'ri so\'rov', 400, request);
    }

    const userService = new UserService();
    const admin = await userService.create(
      {
        ...validation.data,
        role: UserRole.ADMIN,
      },
      user
    );

    const { password, ...adminWithoutPassword } = admin;
    return createSuccessResponse(adminWithoutPassword, 201, request);
  } catch (error: any) {
    return createErrorResponse(error.message || 'Xatolik yuz berdi', 400, request);
  }
}
