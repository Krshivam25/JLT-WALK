export class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}

export function errorHandler(error: Error & { statusCode?: number; validation?: unknown }) {
  if (error.validation) {
    return { statusCode: 400, error: 'Validation Error', message: error.message };
  }
  if (error instanceof AppError) {
    return { statusCode: error.statusCode, error: error.name, message: error.message };
  }
  console.error('Unhandled error:', error);
  return { statusCode: 500, error: 'Internal Server Error', message: error.message };
}
