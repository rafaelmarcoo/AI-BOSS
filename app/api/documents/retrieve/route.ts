import { NextRequest } from 'next/server'
import { z } from 'zod'
import { ApiError } from '@/lib/api/errors'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import { retrieveRelevantDocumentChunks } from '@/lib/documents/retrieval'

const RetrieveDocumentsSchema = z.object({
  query: z.string().trim().min(1),
  limit: z.number().int().min(1).max(10).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const parsed = RetrieveDocumentsSchema.safeParse(await request.json())

    if (!parsed.success) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Invalid retrieval request.',
        parsed.error.flatten().fieldErrors
      )
    }

    const chunks = await retrieveRelevantDocumentChunks({
      userId: user.id,
      query: parsed.data.query,
      limit: parsed.data.limit,
    })

    return successResponse({
      chunks,
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
