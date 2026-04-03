import { Request, Response, NextFunction } from 'express';
import { isAccessTokenSessionActive, verifyJwt } from '../services/authService';
import ApiError from '../utils/ApiError';

export interface AuthRequest extends Request {
  user?: any;
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
    const payload = verifyJwt(token);
    const isActive = await isAccessTokenSessionActive(token);

    if (!isActive) {
      return next(new ApiError(401, 'Token khong hop le hoac da het han.'));
    }

    req.user = payload;
    next();
  } catch (err: any) {
    if (err.message === 'TOKEN_EXPIRED') {
      return next(new ApiError(401, 'Token đã hết hạn.'));
    }
    return next(new ApiError(401, 'Token rỗng hoặc không hợp lệ.'));
  }
}
