import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';
import { ZodError } from 'zod';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);

  if (err instanceof ZodError) {
    return sendError(res, 'Validation error', 'VALIDATION_ERROR', 400, err.errors);
  }

  if (err.name === 'UnauthorizedError') {
    return sendError(res, 'Unauthorized access', 'UNAUTHORIZED', 401);
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  return sendError(res, message, 'INTERNAL_ERROR', statusCode);
};
