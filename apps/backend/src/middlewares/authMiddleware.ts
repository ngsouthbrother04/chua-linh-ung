import { Request, Response, NextFunction } from 'express';
import { isAccessTokenSessionActive, verifyJwt } from '../services/authService';
import ApiError from '../utils/ApiError';

export type AuthRole = 'USER' | 'PARTNER' | 'ADMIN';

export interface JwtAuthPayload {
  sub?: string;
  jti?: string;
  sid?: string;
  typ?: string;
  role?: AuthRole;
  [key: string]: unknown;
}

export interface AuthRequest extends Request {
  user?: JwtAuthPayload;
}

function toRole(value: unknown): AuthRole {
  if (value === 'ADMIN' || value === 'PARTNER' || value === 'USER') {
    return value;
  }

  return 'USER';
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new ApiError(401, 'Thiếu hoặc sai định dạng Authorization Bearer token.'));
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return next(new ApiError(401, 'Token rỗng hoặc không hợp lệ.'));
  }

  try {
    const payload = verifyJwt(token) as JwtAuthPayload;
    const isActive = await isAccessTokenSessionActive(token);

    if (!isActive) {
      return next(new ApiError(401, 'Token khong hop le hoac da het han.'));
    }

    req.user = {
      ...payload,
      role: toRole(payload.role)
    };
    next();
  } catch (err: any) {
    if (err.message === 'TOKEN_EXPIRED') {
      return next(new ApiError(401, 'Token đã hết hạn.'));
    }
    return next(new ApiError(401, 'Token rỗng hoặc không hợp lệ.'));
  }
}

export function requireRole(allowedRoles: AuthRole[]) {
  const roleSet = new Set(allowedRoles);

  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    const currentRole = toRole(req.user?.role);
    if (!roleSet.has(currentRole)) {
      return next(new ApiError(403, 'Không có quyền truy cập tài nguyên này.'));
    }

    next();
  };
}
