import { ErrorCode, ErrorCodeType } from "./error-codes";

// AppError — every thrown error carries a stable errorCode now

export class AppError extends Error {
  public statusCode:    number;
  public errorCode:     ErrorCodeType;
  public isOperational: boolean;
  public errors:        string[];

  constructor(
    message:    string,
    statusCode: number = 500,
    errorCode:  ErrorCodeType = ErrorCode.SYSTEM_INTERNAL_ERROR,
    errors:     string[] = []
  ) {
    super(message);
    this.statusCode    = statusCode;
    this.errorCode     = errorCode;
    this.isOperational = statusCode < 500;
    this.errors        = errors;
    Error.captureStackTrace(this, this.constructor);
  }
}

//Error factories -each maps to one stable errorCode

export const NoTokenError = (msg = "No token provided") =>
  new AppError(msg, 401, ErrorCode.AUTH_NO_TOKEN);

export const TokenMalformedError = (msg = "Invalid token format") =>
  new AppError(msg, 401, ErrorCode.AUTH_TOKEN_MALFORMED);

export const TokenExpiredError = (msg = "Token expired") =>
  new AppError(msg, 401, ErrorCode.AUTH_TOKEN_EXPIRED);

export const TokenInvalidError = (msg = "Invalid token") =>
  new AppError(msg, 401, ErrorCode.AUTH_TOKEN_INVALID);

export const TokenRevokedError = (msg = "Token has been revoked") =>
  new AppError(msg, 401, ErrorCode.AUTH_TOKEN_REVOKED);

export const RefreshInvalidError = (msg = "Invalid or expired refresh token") =>
  new AppError(msg, 401, ErrorCode.AUTH_REFRESH_INVALID);

export const InvalidCredentialsError = (msg = "Invalid email or password") =>
  new AppError(msg, 401, ErrorCode.AUTH_INVALID_CREDENTIALS);

export const AccountInactiveError = (msg = "Account is deactivated. Contact your administrator.") =>
  new AppError(msg, 401, ErrorCode.AUTH_ACCOUNT_INACTIVE);

export const ValidationFailedError = (msg = "Validation failed", errors: string[] = []) =>
  new AppError(msg, 400, ErrorCode.VALIDATION_FAILED, errors);

export const NotFoundError = (msg = "Resource not found") =>
  new AppError(msg, 404, ErrorCode.RESOURCE_NOT_FOUND);

export const ConflictError = (msg: string) =>
  new AppError(msg, 409, ErrorCode.RESOURCE_CONFLICT);

export const LimitReachedError = (msg: string) =>
  new AppError(msg, 403, ErrorCode.RESOURCE_LIMIT_REACHED);

export const ForbiddenPermissionError = (msg: string) =>
  new AppError(msg, 403, ErrorCode.FORBIDDEN_PERMISSION);

export const ForbiddenBranchError = (msg = "Access denied to this branch") =>
  new AppError(msg, 403, ErrorCode.FORBIDDEN_BRANCH_ACCESS);

// Generic forbidden (legacy alias used by rbac.middleware)
export const ForbiddenError = (msg = "Forbidden") =>
  new AppError(msg, 403, ErrorCode.FORBIDDEN_PERMISSION);

// Generic unauthorized (legacy alias)
export const UnauthorizedError = (msg = "Unauthorized") =>
  new AppError(msg, 401, ErrorCode.AUTH_TOKEN_INVALID);

// Generic bad request (legacy alias used in a few places)
export const BadRequestError = (msg: string, errors: string[] = []) =>
  new AppError(msg, 400, ErrorCode.VALIDATION_FAILED, errors);