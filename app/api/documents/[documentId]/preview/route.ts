import { NextRequest } from 'next/server'
import { ApiError } from '@/lib/api/errors'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import {
  DOCUMENT_PREVIEW_DEFAULT_PAGE_SIZE,
  DOCUMENT_PREVIEW_MAX_PAGE_SIZE,
  getDocumentPreview,
} from '@/lib/documents/review'
import type { DocumentPreviewResponse } from '@/lib/documents/types'

export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ documentId: string }>
}

function readPositiveInteger(
  value: string | null,
  fallback: number,
  fieldName: string
) {
  if (value === null) return fallback
  if (!/^\d+$/.test(value) || Number(value) < 1) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      `${fieldName} must be a positive integer.`
    )
  }
  return Number(value)
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const { documentId } = await context.params
    const page = readPositiveInteger(
      request.nextUrl.searchParams.get('page'),
      1,
      'page'
    )
    const pageSize = readPositiveInteger(
      request.nextUrl.searchParams.get('pageSize'),
      DOCUMENT_PREVIEW_DEFAULT_PAGE_SIZE,
      'pageSize'
    )

    if (pageSize > DOCUMENT_PREVIEW_MAX_PAGE_SIZE) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        `pageSize cannot exceed ${DOCUMENT_PREVIEW_MAX_PAGE_SIZE}.`
      )
    }

    const sheetName = request.nextUrl.searchParams.get('sheet')?.trim()
    const preview = await getDocumentPreview({
      documentId,
      userId: user.id,
      page,
      pageSize,
      ...(sheetName ? { sheetName } : {}),
    })

    return successResponse<DocumentPreviewResponse>(preview)
  } catch (error) {
    return handleRouteError(error)
  }
}
