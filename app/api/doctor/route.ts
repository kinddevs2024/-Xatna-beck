import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/lib/services/user.service';
import { authMiddleware, createErrorResponse, createSuccessResponse, roleMiddleware } from '@/lib/middleware';
import { handleOptions } from '@/lib/cors';
import { UserRole } from '@/types';
import { z } from 'zod';

const createDoctorSchema = z.object({
  name: z.string().min(1),
  phone_number: z.string().optional(),
  tg_username: z.string().optional(),
  password: z.string().optional(),
  working: z.boolean().optional(),
  work_start_time: z.string().optional(),
  work_end_time: z.string().optional(),
  profile_image: z.string().optional(),
});

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function GET(request: NextRequest) {
  try {
    // Публичный endpoint для получения информации о докторе
    const userService = new UserService();
    const doctor = await userService.findDefaultDoctor();

    if (!doctor) {
      return createErrorResponse('Doktor topilmadi', 404, request);
    }

    // Убрать пароль из ответа
    const { password, ...doctorWithoutPassword } = doctor;
    
    return createSuccessResponse([doctorWithoutPassword], 200, request);
  } catch (error: any) {
    return createErrorResponse(error.message || 'Xatolik yuz berdi', 500, request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    if (user instanceof NextResponse) {
      return user;
    }

    // Проверка роли
    if (!roleMiddleware([UserRole.ADMIN, UserRole.SUPER_ADMIN])(user)) {
      return createErrorResponse('Ruxsat yo\'q', 403, request);
    }

    const body = await request.json();
    const validation = createDoctorSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse('Noto\'g\'ri so\'rov', 400, request);
    }

    const userService = new UserService();
    const doctor = await userService.create(
      {
        ...validation.data,
        role: UserRole.DOCTOR,
      },
      user
    );

    const { password, ...doctorWithoutPassword } = doctor;
    return createSuccessResponse(doctorWithoutPassword, 201, request);
  } catch (error: any) {
    return createErrorResponse(error.message || 'Xatolik yuz berdi', 400, request);
  }
}
