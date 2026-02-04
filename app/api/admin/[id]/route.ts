import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/lib/services/user.service';
import { authMiddleware, createErrorResponse, createSuccessResponse, roleMiddleware } from '@/lib/middleware';
import { handleOptions } from '@/lib/cors';
import { UserRole } from '@/types';
import { z } from 'zod';

const updateAdminSchema = z.object({
  name: z.string().optional(),
  tg_username: z.string().optional(),
  phone_number: z.string().optional(),
  password: z.string().optional(),
  profile_image: z.string().optional(),
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

    // Проверка роли - только SUPER_ADMIN может обновлять админов
    if (!roleMiddleware([UserRole.SUPER_ADMIN])(user)) {
      return createErrorResponse('Ruxsat yo\'q', 403, request);
    }

    const id = params.id;
    if (!id) {
      return createErrorResponse("Noto'g'ri ID format", 400, request);
    }

    const body = await request.json();
    const validation = updateAdminSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse('Noto\'g\'ri so\'rov', 400, request);
    }

    const userService = new UserService();
    const admin = await userService.update(id, validation.data);

    const { password, ...adminWithoutPassword } = admin;
    return createSuccessResponse(adminWithoutPassword, 200, request);
  } catch (error: any) {
    return createErrorResponse(error.message || 'Xatolik yuz berdi', 500, request);
  }
}
