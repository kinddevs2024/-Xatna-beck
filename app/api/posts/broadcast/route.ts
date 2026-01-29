import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware, createErrorResponse, createSuccessResponse, roleMiddleware } from '@/lib/middleware';
import { handleOptions } from '@/lib/cors';
import { UserRole } from '@/types';
import { prisma } from '@/lib/db';
import { telegramService } from '@/lib/services/telegram.service';

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

// POST /posts/broadcast - отправка broadcast сообщения всем клиентам
export async function POST(request: NextRequest) {
  try {
    const user = await authMiddleware(request);
    if (user instanceof NextResponse) {
      return user;
    }

    console.log('[Broadcast] User from token:', JSON.stringify(user));
    console.log('[Broadcast] User role:', user.role);
    console.log('[Broadcast] Checking role:', UserRole.ADMIN, UserRole.SUPER_ADMIN);

    // Проверка роли - только админы могут отправлять broadcast
    const hasRole = roleMiddleware([UserRole.ADMIN, UserRole.SUPER_ADMIN])(user);
    console.log('[Broadcast] Role check result:', hasRole);

    if (!hasRole) {
      return createErrorResponse(`Ruxsat yo'q. Sizning role: ${user.role}`, 403, request);
    }

    // Получить данные из FormData или JSON
    const contentType = request.headers.get('content-type') || '';
    let body: any;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      body = {
        title: formData.get('title')?.toString() || '',
        description: formData.get('description')?.toString() || '',
        image: formData.get('image'),
        image_url: formData.get('image_url')?.toString() || '',
      };
    } else {
      body = await request.json();
    }

    if (!body.description || !body.description.trim()) {
      return createErrorResponse('Tavsif talab qilinadi', 400, request);
    }

    // Получить всех клиентов с Telegram ID
    const clients = await prisma.user.findMany({
      where: { 
        role: UserRole.CLIENT,
        tg_id: { not: null }, // Только клиенты с Telegram ID
      },
    });

    const totalClients = clients.length;

    if (totalClients === 0) {
      return createSuccessResponse({
        message: 'Telegram ID ga ega bo\'lgan mijozlar topilmadi',
        totalClients: 0,
        sentCount: 0,
        failedCount: 0,
      }, 200, request);
    }

    // Проверяем, инициализирован ли бот
    if (!telegramService.isInitialized()) {
      return createErrorResponse('Telegram Bot sozlanmagan. BOT_TOKEN ni tekshiring.', 500, request);
    }

    // Формируем сообщение
    let message = body.description || '';
    if (body.title) {
      message = `*${body.title}*\n\n${message}`;
    }

    // Получаем Telegram ID клиентов
    const chatIds = clients
      .map(client => client.tg_id)
      .filter((tgId): tgId is string => tgId !== null && tgId !== undefined)
      .map(tgId => String(tgId)); // Преобразуем в строку, если нужно

    let sentCount = 0;
    let failedCount = 0;

    // Отправляем сообщение с изображением или без
    if (body.image_url || body.image) {
      let photo: string | Buffer | null = null;
      
      if (body.image_url) {
        // Если это URL, используем его напрямую
        photo = body.image_url;
      } else if (body.image instanceof File) {
        // Если это File, конвертируем в Buffer
        try {
          const arrayBuffer = await body.image.arrayBuffer();
          photo = Buffer.from(arrayBuffer);
        } catch (error) {
          console.error('Error converting File to Buffer:', error);
          photo = null;
        }
      }
      
      if (photo) {
        const result = await telegramService.sendBroadcastPhoto(
          chatIds,
          photo,
          message,
          { parse_mode: 'Markdown' }
        );
        sentCount = result.sent;
        failedCount = result.failed;
      } else {
        // Если изображение не удалось загрузить, отправляем только текст
        const result = await telegramService.sendBroadcast(
          chatIds,
          message,
          { parse_mode: 'Markdown' }
        );
        sentCount = result.sent;
        failedCount = result.failed;
      }
    } else {
      // Отправляем только текстовое сообщение
      const result = await telegramService.sendBroadcast(
        chatIds,
        message,
        { parse_mode: 'Markdown' }
      );
      sentCount = result.sent;
      failedCount = result.failed;
    }

    return createSuccessResponse({
      message: 'Post muvaffaqiyatli yuborildi',
      totalClients,
      sentCount,
      failedCount,
    }, 200, request);
  } catch (error: any) {
    console.error('Error in POST /posts/broadcast:', error);
    return createErrorResponse(error.message || 'Xatolik yuz berdi', 500, request);
  }
}
