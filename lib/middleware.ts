import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, TokenPayload } from './auth';
import { UserRole } from '@/types';
import { corsHeaders } from './cors';

export interface AuthenticatedRequest extends NextRequest {
  user?: TokenPayload;
}

export async function authMiddleware(request: NextRequest): Promise<NextResponse | TokenPayload> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Token topilmadi' },
      { status: 401, headers: corsHeaders(request) }
    );
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);

  if (!decoded) {
    return NextResponse.json(
      { error: "Token noto'g'ri yoki muddati o'tgan" },
      { status: 401, headers: corsHeaders(request) }
    );
  }

  return decoded;
}

export function roleMiddleware(allowedRoles: UserRole[]) {
  return (user: TokenPayload): boolean => {
    if (!user || !user.role) {
      console.error('[RoleMiddleware] User or role is missing:', user);
      return false;
    }
    const hasRole = allowedRoles.includes(user.role);
    if (process.env.DEBUG_ROLES === 'true') {
      console.log('[RoleMiddleware] User role:', user.role, 'Allowed roles:', allowedRoles, 'Result:', hasRole);
    }
    return hasRole;
  };
}

export function createErrorResponse(message: string, status: number = 400, request?: NextRequest) {
  return NextResponse.json(
    {
      statusCode: status,
      timestamp: new Date().toISOString(),
      message: [message],
      error: status === 400 ? 'Bad Request' : status === 401 ? 'Unauthorized' : status === 403 ? 'Forbidden' : 'Internal Server Error',
    },
    { status, headers: corsHeaders(request) }
  );
}

export function createSuccessResponse(data: any, status: number = 200, request?: NextRequest) {
  return NextResponse.json(data, { status, headers: corsHeaders(request) });
}
