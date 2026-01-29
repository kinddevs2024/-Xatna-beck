import { NextRequest, NextResponse } from 'next/server';
import { createErrorResponse, createSuccessResponse, authMiddleware } from '@/lib/middleware';
import { handleOptions } from '@/lib/cors';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const updateServiceSchema = z.object({
  name: z.string().optional(),
  price: z.union([z.number(), z.string()]).optional().transform((val) => {
    if (val === undefined || val === null || val === '') return undefined;
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return isNaN(num) ? undefined : Math.round(num);
  }),
  duration: z.number().optional(),
  image_url: z.string().optional(),
});

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const serviceId = parseInt(params.id);
    if (isNaN(serviceId)) {
      return createErrorResponse("Noto'g'ri ID format", 400, request);
    }

    try {
      const service = await (prisma as any).service?.findUnique({
        where: { id: serviceId },
      });

      if (!service) {
        return createErrorResponse('Xizmat topilmadi', 404, request);
      }

      return createSuccessResponse(service, 200, request);
    } catch (modelError: any) {
      if (modelError.message?.includes('Cannot read properties of undefined') || !(prisma as any).service) {
        return createErrorResponse('Ma\'lumotlar bazasi yangilanmagan', 500, request);
      }
      throw modelError;
    }
  } catch (error: any) {
    return createErrorResponse(error.message || 'Xatolik yuz berdi', 500, request);
  }
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

    const serviceId = parseInt(params.id);
    if (isNaN(serviceId)) {
      return createErrorResponse("Noto'g'ri ID format", 400, request);
    }

    // Получить данные из FormData или JSON (как в POST)
    const contentType = request.headers.get('content-type') || '';
    let body: any;

    try {
      // Проверяем, является ли это FormData
      if (contentType.includes('multipart/form-data') || contentType.includes('form-data')) {
        const formData = await request.formData();
        
        const nameValue = formData.get('name')?.toString();
        const priceValue = formData.get('price')?.toString();
        const imageFile = formData.get('image_url') as File | null;
        
        body = {
          name: nameValue?.trim(),
          price: priceValue || undefined,
          // Если файл предоставлен, сохраняем имя файла, иначе не обновляем image_url
          image_url: imageFile && imageFile.size > 0 ? imageFile.name : undefined,
        };
      } else {
        body = await request.json();
        if (body.name) body.name = body.name.trim();
      }
    } catch (parseError: any) {
      console.error('Error parsing request body:', parseError);
      return createErrorResponse('Noto\'g\'ri so\'rov formati', 400, request);
    }

    const validation = updateServiceSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse('Noto\'g\'ri so\'rov', 400, request);
    }

    const updateData: any = {};
    if (validation.data.name !== undefined) updateData.name = validation.data.name;
    if (validation.data.price !== undefined) updateData.price = validation.data.price;
    if (validation.data.image_url !== undefined) updateData.image_url = validation.data.image_url;
    // duration всегда 30, не обновляем

    try {
      const service = await (prisma as any).service?.update({
        where: { id: serviceId },
        data: updateData,
      });

      return createSuccessResponse(service, 200, request);
    } catch (modelError: any) {
      if (modelError.message?.includes('Cannot read properties of undefined') || !(prisma as any).service) {
        return createErrorResponse('Ma\'lumotlar bazasi yangilanmagan', 500, request);
      }
      throw modelError;
    }
  } catch (error: any) {
    console.error('Error updating service:', error);
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

    const serviceId = parseInt(params.id);
    if (isNaN(serviceId)) {
      return createErrorResponse("Noto'g'ri ID format", 400, request);
    }

    try {
      await (prisma as any).service?.delete({
        where: { id: serviceId },
      });

      return createSuccessResponse({ message: 'Xizmat muvaffaqiyatli o\'chirildi' }, 200, request);
    } catch (modelError: any) {
      if (modelError.message?.includes('Cannot read properties of undefined') || !(prisma as any).service) {
        return createErrorResponse('Ma\'lumotlar bazasi yangilanmagan', 500, request);
      }
      throw modelError;
    }
  } catch (error: any) {
    console.error('Error deleting service:', error);
    return createErrorResponse(error.message || 'Xatolik yuz berdi', 500, request);
  }
}
