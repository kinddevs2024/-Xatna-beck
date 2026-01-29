import { NextRequest, NextResponse } from 'next/server';
import { createSuccessResponse, createErrorResponse, authMiddleware } from '@/lib/middleware';
import { handleOptions } from '@/lib/cors';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const createServiceSchema = z.object({
  name: z.string().min(1, "Xizmat nomi talab qilinadi"),
  price: z.union([z.number(), z.string()]).optional().transform((val) => {
    if (val === undefined || val === null || val === '') return undefined;
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return isNaN(num) ? undefined : Math.round(num);
  }),
  duration: z.number().optional(),
  image_url: z.union([z.string(), z.instanceof(File)]).optional().nullable(),
});

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function GET(request: NextRequest) {
  try {
    // Пытаемся получить сервисы
    const services = await (prisma as any).service?.findMany({
      orderBy: { created_at: 'desc' },
    }) || [];
    return createSuccessResponse(services, 200, request);
  } catch (error: any) {
    console.error('Error fetching services:', error);
    // Всегда возвращаем пустой массив вместо ошибки для совместимости
    return createSuccessResponse([], 200, request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    if (user instanceof NextResponse) {
      return user;
    }

    // Получить данные из FormData или JSON
    const contentType = request.headers.get('content-type') || '';
    let body: any;

    try {
      // Проверяем, является ли это FormData (обычно начинается с multipart/form-data)
      if (contentType.includes('multipart/form-data') || contentType.includes('form-data')) {
        const formData = await request.formData();
        
        const nameValue = formData.get('name')?.toString() || '';
        const priceValue = formData.get('price')?.toString();
        const imageFile = formData.get('image_url') as File | null;
        
        body = {
          name: nameValue.trim(),
          price: priceValue || undefined, // Оставляем как строку, схема преобразует
          duration: 30, // Всегда 30 минут
          image_url: imageFile && imageFile.size > 0 ? imageFile : null,
        };
      } else {
        body = await request.json();
        body.duration = 30; // Всегда 30 минут
        if (body.name) body.name = body.name.trim();
      }
    } catch (parseError: any) {
      console.error('Error parsing request body:', parseError);
      return createErrorResponse('Noto\'g\'ri so\'rov formati', 400, request);
    }

    const validation = createServiceSchema.safeParse(body);
    if (!validation.success) {
      console.error('Validation error:', validation.error.errors);
      const errorMessages = validation.error.errors.map(e => e.message).join(', ');
      return createErrorResponse(errorMessages || 'Noto\'g\'ri so\'rov', 400, request);
    }

    const priceValue = validation.data.price !== undefined
      ? validation.data.price
      : Math.round(parseFloat(process.env.FIXED_SERVICE_PRICE || '50000'));

    // Обработка изображения - если это File, сохраняем только имя, иначе строку
    let imageUrl: string | null = null;
    if (validation.data.image_url) {
      if (validation.data.image_url instanceof File) {
        // Для файлов пока сохраняем имя, в будущем можно добавить загрузку
        imageUrl = validation.data.image_url.name;
      } else {
        imageUrl = validation.data.image_url;
      }
    }

    // Создаем сервис - проверяем доступность модели перед использованием
    const serviceModel = (prisma as any).service;
    if (!serviceModel || typeof serviceModel.create !== 'function') {
      console.error('Prisma Service model not available. Please restart server after: npx prisma generate');
      return createErrorResponse('Ma\'lumotlar bazasi yangilanmagan. Iltimos, serverni to\'xtating, "npx prisma generate" ni ishga tushiring va serverni qayta ishga tushiring.', 500, request);
    }

    try {
      const service = await serviceModel.create({
        data: {
          name: validation.data.name,
          price: priceValue,
          duration: 30, // Всегда 30 минут
          image_url: imageUrl,
        },
      });

      return createSuccessResponse(service, 201, request);
    } catch (createError: any) {
      console.error('Database error creating service:', createError);
      return createErrorResponse(createError.message || 'Xizmat yaratishda xatolik', 500, request);
    }
  } catch (error: any) {
    console.error('Error creating service:', error);
    // Если таблица не существует, возвращаем понятную ошибку
    if (error.message?.includes('does not exist') || error.message?.includes('no such table') || error.message?.includes('Cannot read properties of undefined')) {
      return createErrorResponse('Ma\'lumotlar bazasi yangilanmagan. Iltimos, serverni to\'xtating, "npx prisma generate" ni ishga tushiring va serverni qayta ishga tushiring.', 500, request);
    }
    return createErrorResponse(error.message || 'Xatolik yuz berdi', 500, request);
  }
}
