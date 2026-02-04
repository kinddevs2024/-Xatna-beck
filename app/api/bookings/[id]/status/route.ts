import { NextRequest, NextResponse } from 'next/server';
import { BookingService } from '@/lib/services/booking.service';
import { authMiddleware, createErrorResponse, createSuccessResponse, roleMiddleware } from '@/lib/middleware';
import { handleOptions } from '@/lib/cors';
import { BookingStatus, UserRole } from '@/types';
import { z } from 'zod';

// Схема для совместимости - принимает строку (lowercase) и преобразует в enum
const updateStatusSchema = z.object({
  status: z.string(),
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

    const id = params.id;
    if (!id) {
      return createErrorResponse("Noto'g'ri ID format", 400, request);
    }

    const body = await request.json();
    const validation = updateStatusSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse('Noto\'g\'ri so\'rov', 400, request);
    }

    // Преобразовать строку в enum
    const statusStr = validation.data.status.toUpperCase();
    let statusValue: BookingStatus;
    
    if (statusStr === 'PENDING') statusValue = BookingStatus.PENDING;
    else if (statusStr === 'APPROVED') statusValue = BookingStatus.APPROVED;
    else if (statusStr === 'REJECTED') statusValue = BookingStatus.REJECTED;
    else if (statusStr === 'CANCELLED') statusValue = BookingStatus.CANCELLED;
    else if (statusStr === 'COMPLETED') statusValue = BookingStatus.COMPLETED;
    else {
      return createErrorResponse(`Invalid status: ${validation.data.status}. Must be one of: pending, approved, rejected, cancelled, completed`, 400, request);
    }

    const bookingService = new BookingService();
    const booking = await bookingService.updateStatus(id, statusValue);

    return createSuccessResponse(booking, 200, request);
  } catch (error: any) {
    return createErrorResponse(error.message || 'Xatolik yuz berdi', 500, request);
  }
}
