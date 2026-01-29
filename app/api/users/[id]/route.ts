import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/lib/services/user.service';
import { authMiddleware, createErrorResponse, createSuccessResponse, roleMiddleware } from '@/lib/middleware';
import { handleOptions, corsHeaders } from '@/lib/cors';
import { UserRole } from '@/types';
import { prisma } from '@/lib/db';

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function GET(
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

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return createErrorResponse("Noto'g'ri ID format", 400, request);
    }

    const userService = new UserService();
    const foundUser = await userService.findOne(id);

    if (!foundUser) {
      return createErrorResponse('Foydalanuvchi topilmadi', 404, request);
    }

    const { password, ...userWithoutPassword } = foundUser;
    return createSuccessResponse(userWithoutPassword, 200, request);
  } catch (error: any) {
    return createErrorResponse(error.message || 'Xatolik yuz berdi', 500, request);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authMiddleware(request);
    if (user instanceof NextResponse) {
      return user;
    }

    // Проверка роли
    if (!roleMiddleware([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.DOCTOR])(user)) {
      return createErrorResponse('Ruxsat yo\'q', 403, request);
    }

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return createErrorResponse("Noto'g'ri ID format", 400, request);
    }

    // Doctor может удалить только себя
    if (user.role === UserRole.DOCTOR && user.id !== id) {
      return createErrorResponse('Doctor faqat o\'zining ma\'lumotlarini o\'chirishi mumkin', 403, request);
    }

    await prisma.user.delete({ where: { id } });

    return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
  } catch (error: any) {
    return createErrorResponse(error.message || 'Xatolik yuz berdi', 500, request);
  }
}
