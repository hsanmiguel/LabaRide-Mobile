import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';
import { ZodError } from 'zod';
import { describeDatabaseError } from '../utils/database-error';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err?.type === 'entity.too.large') return sendError(res, 'Choose an image smaller than 6 MB.', 'PAYLOAD_TOO_LARGE', 413);
  if (err?.type === 'entity.parse.failed') return sendError(res, 'Invalid JSON request', 'BAD_REQUEST', 400);
  if (err instanceof ZodError) {
    return sendError(res, 'Validation error', 'VALIDATION_ERROR', 400, err.errors);
  }

  if (err?.name === 'UnauthorizedError') {
    return sendError(res, 'Unauthorized access', 'UNAUTHORIZED', 401);
  }

  const failure = describeDatabaseError(err);
  if (failure.isDatabaseError) {
    console.error(`Database request failed (${failure.code}). ${failure.message}`);
    const message = failure.apiCode === 'DATABASE_UNAVAILABLE'
      ? 'Database temporarily unavailable. Please try again later.'
      : failure.message;
    return sendError(res, message, failure.apiCode, failure.status);
  }

  const statusCode = err?.statusCode || 500;
  if (statusCode >= 500) console.error('Request failed.');
  const message = statusCode < 500 ? err?.message || 'Request failed' : 'Internal Server Error';
  
  return sendError(res, message, 'INTERNAL_ERROR', statusCode);
};
