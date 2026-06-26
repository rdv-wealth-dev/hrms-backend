// AppError
export class AppError extends Error {
  public statusCode:    number;
  public isOperational: boolean;
  public errors:        string[];

  constructor(
    message:    string,
    statusCode: number   = 500,
    errors:     string[] = []
  ) {
    super(message);
    this.statusCode    = statusCode;
    this.isOperational = statusCode < 500;
    this.errors        = errors;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Error factories
export const NotFoundError = (
  msg = "Resource not found"
) => new AppError(msg, 404);

export const UnauthorizedError = (
  msg = "Unauthorized"
) => new AppError(msg, 401);

export const ForbiddenError = (
  msg = "Forbidden"
) => new AppError(msg, 403);

export const BadRequestError = (
  msg:    string,
  errors: string[] = []
) => new AppError(msg, 400, errors);

export const ConflictError = (
  msg: string
) => new AppError(msg, 409);