// Alias для совместимости с фронтендом - использует логику /api/doctor/[id]
import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/lib/services/user.service';
import { authMiddleware, createErrorResponse, createSuccessResponse, roleMiddleware } from '@/lib/middleware';
import { handleOptions } from '@/lib/cors';
import { UserRole } from '@/types';
import { z } from 'zod';

const updateDoctorSchema = z.object({
  name: z.string().optional(),
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authMiddleware(request);
    if (user instanceof NextResponse) {
      return user;
    }

    const id = params.id;
    if (!id) {
      return createErrorResponse("Noto'g'ri ID format", 400, request);
    }

    // Doctor может обновить только себя, админы могут обновить любого доктора
    const userRoleStr = String(user.role).toUpperCase();
    if (userRoleStr === 'DOCTOR' && user.id !== id) {
      return createErrorResponse('Doctor faqat o\'zining ma\'lumotlarini yangilashi mumkin', 403, request);
    }

    let body;
    try {
      const text = await request.text();
      if (!text || text.trim() === '' || text.trim() === '-') {
        return createErrorResponse('Bo\'sh so\'rov', 400, request);
      }
      body = JSON.parse(text);
    } catch (parseError: any) {
      console.error('Error parsing JSON in PATCH /doctor/[id]:', parseError);
      return createErrorResponse('Noto\'g\'ri JSON format', 400, request);
    }

    const validation = updateDoctorSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse('Noto\'g\'ri so\'rov', 400, request);
    }

    const userService = new UserService();
    const doctor = await userService.update(id, validation.data);

    const { password, ...doctorWithoutPassword } = doctor;
    return createSuccessResponse(doctorWithoutPassword, 200, request);
  } catch (error: any) {
    return createErrorResponse(error.message || 'Xatolik yuz berdi', 500, request);
  }
}
