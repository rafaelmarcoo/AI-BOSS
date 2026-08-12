export type ApiErrorCode =
  | 'AUTH_REQUIRED'
  | 'AUTH_INVALID'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR'
  | 'BAD_REQUEST'
  | 'FORBIDDEN'

export class ApiError extends Error {
  status: number
  code: ApiErrorCode
  details?: unknown

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    details?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}
