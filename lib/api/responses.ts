import { NextResponse } from 'next/server'
import { ApiError, isApiError } from '@/lib/api/errors'

export function successResponse<T>(
  data: T,
  init?: ResponseInit,
  message?: string
) {
  return NextResponse.json(
    {
      success: true,
      data,
      ...(message ? { message } : {}),
    },
    init
  )
}

export function errorResponse(error: ApiError) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    },
    { status: error.status }
  )
}

export function handleRouteError(error: unknown) {
  if (isApiError(error)) {
    return errorResponse(error)
  }

  console.error(error)

  return errorResponse(
    new ApiError(500, 'INTERNAL_ERROR', 'An unexpected error occurred.')
  )
}
