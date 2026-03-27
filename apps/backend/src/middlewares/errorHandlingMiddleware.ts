import { NextFunction, Request, Response } from 'express';
import ApiError from '../utils/ApiError';

const KNOWN_ERROR_CODE_MAP: Record<string, { statusCode: number; message: string }> = {
  INVALID_CLAIM_CODE: { statusCode: 400, message: 'Định dạng mã không hợp lệ.' },
  CLAIM_CODE_NOT_FOUND_OR_USED: {
    statusCode: 401,
    message: 'Mã không hợp lệ hoặc đã được sử dụng.'
  },
  INVALID_PAYMENT_AMOUNT: { statusCode: 400, message: 'amount phải là số dương.' },
  PAYMENT_NOT_FOUND: { statusCode: 404, message: 'Không tìm thấy giao dịch thanh toán.' },
  PAYMENT_ALREADY_FINALIZED: { statusCode: 409, message: 'Giao dịch đã chốt ở trạng thái khác.' },
  POI_NOT_FOUND: { statusCode: 404, message: 'Không tìm thấy POI cần xử lý TTS.' },
  TOUR_NOT_FOUND: { statusCode: 404, message: 'Không tìm thấy Tour cần xử lý ảnh.' },
  TTS_NO_SUPPORTED_LANGUAGE_TEXT: {
    statusCode: 400,
    message: 'POI không có nội dung phù hợp để generate TTS theo danh sách ngôn ngữ hỗ trợ.'
  },
  REDIS_URL_NOT_CONFIGURED: {
    statusCode: 500,
    message: 'Thiếu REDIS_URL cho chế độ queue BullMQ.'
  },
  CLOUDINARY_NOT_CONFIGURED: {
    statusCode: 500,
    message: 'Thiếu cấu hình Cloudinary cho upload ảnh.'
  },
  CLOUDINARY_UPLOAD_FAILED: {
    statusCode: 502,
    message: 'Upload ảnh lên Cloudinary thất bại.'
  }
};

function normalizeError(err: unknown): { statusCode: number; message: string; stack?: string } {
  if (err instanceof ApiError) {
    return {
      statusCode: err.statusCode,
      message: err.message,
      stack: err.stack
    };
  }

  if (err instanceof Error && KNOWN_ERROR_CODE_MAP[err.message]) {
    const mapped = KNOWN_ERROR_CODE_MAP[err.message];
    return {
      statusCode: mapped.statusCode,
      message: mapped.message,
      stack: err.stack
    };
  }

  if (err instanceof Error) {
    return {
      statusCode: 500,
      message: err.message || 'Lỗi máy chủ nội bộ.',
      stack: err.stack
    };
  }

  return {
    statusCode: 500,
    message: 'Lỗi máy chủ nội bộ.'
  };
}

export function notFoundMiddleware(req: Request, res: Response, next: NextFunction): void {
  next(new ApiError(404, `Không tìm thấy endpoint: ${req.method} ${req.originalUrl}`));
}

export function errorHandlingMiddleware(err: unknown, req: Request, res: Response, next: NextFunction): void {
  const normalized = normalizeError(err);
  const responseError: { statusCode: number; message: string; stack?: string } = {
    statusCode: normalized.statusCode,
    message: normalized.message
  };

  if (process.env.NODE_ENV !== 'production' && normalized.stack) {
    responseError.stack = normalized.stack;
  }

  res.status(responseError.statusCode).json(responseError);
}
