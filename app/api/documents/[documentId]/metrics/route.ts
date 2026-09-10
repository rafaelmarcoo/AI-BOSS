import { NextRequest } from 'next/server'
import { ApiError } from '@/lib/api/errors'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import { updateDocumentExtractedMetric } from '@/lib/documents/persistence'

interface RouteContext {
  params: Promise<{ documentId: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const { documentId } = await context.params
    const body = (await request.json()) as { label?: unknown; value?: unknown }

    if (typeof body.label !== 'string' || !body.label.trim()) {
      throw new ApiError(400, 'BAD_REQUEST', 'label is required.')
    }

    if (typeof body.value !== 'number' || !Number.isFinite(body.value)) {
      throw new ApiError(400, 'BAD_REQUEST', 'value must be a finite number.')
    }

    const document = await updateDocumentExtractedMetric({
      documentId,
      userId: user.id,
      label: body.label,
      value: body.value,
    })

    return successResponse({ document })
  } catch (error) {
    return handleRouteError(error)
  }
}
