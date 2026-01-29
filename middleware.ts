import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const allowedOrigins = [
  'https://xatna-markasi-n1.uz',
  'https://xatna-front.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'http://localhost:4173', // Vite preview
];

export function middleware(request: NextRequest) {
  // НЕ вызываем initializeDatabase здесь - это Edge Runtime!
  // Инициализация будет выполнена через /api/init endpoint

  // Обработка CORS для всех API запросов
  const origin = request.headers.get('origin');
  
  // В development разрешаем ЛЮБОЙ origin (полностью отключаем CORS проверки)
  let allowedOrigin: string;
  if (process.env.NODE_ENV === 'development') {
    // В development разрешаем любой origin из запроса (для поддержки credentials)
    // Если origin нет, используем дефолтный
    allowedOrigin = origin || 'http://localhost:5173';
  } else {
    // В production используем whitelist
    const isAllowedOrigin = origin && (
      allowedOrigins.includes(origin) || 
      origin.includes('localhost') || 
      origin.includes('127.0.0.1') ||
      origin.includes('vercel.app')
    );
    allowedOrigin = (isAllowedOrigin && origin) 
      ? origin 
      : (process.env.FRONTEND_URL || 'https://xatna-front.vercel.app');
  }

  // Для OPTIONS запросов возвращаем CORS headers
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, X-Requested-With',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // Для остальных запросов добавляем CORS headers
  const response = NextResponse.next();
  
  response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
  response.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With');
  response.headers.set('Access-Control-Allow-Credentials', 'true');

  return response;
}

export const config = {
  // Перехватываем все API пути и пути без /api для совместимости
  matcher: [
    '/api/:path*',
    '/auth/:path*',
    '/users/:path*',
    '/admin/:path*',
    '/barber/:path*',
    '/bookings/:path*',
    '/barber-services/:path*',
    '/service-categories/:path*',
    '/doctor/:path*',
    '/client/:path*',
    '/posts/:path*',
  ],
};
