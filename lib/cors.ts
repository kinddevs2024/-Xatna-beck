import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const allowedOrigins = [
  'https://xatna-markasi-n1.uz',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'http://localhost:4173', // Vite preview
];

export function corsHeaders(request?: NextRequest) {
  let origin = process.env.FRONTEND_URL || 'https://xatna-markasi-n1.uz';
  
  // В development полностью отключаем CORS проверки - разрешаем любой origin
  if (process.env.NODE_ENV === 'development') {
    if (request) {
      const requestOrigin = request.headers.get('origin');
      // Используем origin из запроса или дефолтный (для поддержки credentials)
      origin = requestOrigin || 'http://localhost:5173';
    } else {
      origin = 'http://localhost:5173';
    }
  } else {
    // В production используем whitelist
    if (request) {
      const requestOrigin = request.headers.get('origin');
      if (requestOrigin) {
        if (allowedOrigins.includes(requestOrigin)) {
          origin = requestOrigin;
        } else if (requestOrigin.includes('localhost') || requestOrigin.includes('127.0.0.1')) {
          origin = requestOrigin;
        }
      }
    }
  }
  
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
  };
}

export function handleOptions(request?: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(request),
  });
}
