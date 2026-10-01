import { NextRequest } from 'next/server'
import { ApiError } from '@/lib/api/errors'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import {
  addDocumentExtractedItem,
  updateDocumentExtractedItem,
} from '@/lib/documents/persistence'
import { toItemAttributes } from '@/lib/financial-data/attributes'
import type { AttributeChanges } from '@/lib/financial-data/item-matrix'

interface RouteContext {
  params: Promise<{ documentId: string }>
}

function readFiniteNumber(value: unknown, name: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ApiError(400, 'BAD_REQUEST', `${name} must be a finite number.`)
  }

  return value
}

// Attribute changes map a name to a new value; null (or blank text) removes it.
function readAttributeChanges(value: unknown): AttributeChanges {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(400, 'BAD_REQUEST', 'attributes must be an object.')
  }

  const changes: AttributeChanges = {}

  for (const [key, change] of Object.entries(value as Record<string, unknown>)) {
    if (change === null || typeof change === 'string') {
      changes[key] = change
    } else if (typeof change === 'number' && Number.isFinite(change)) {
      changes[key] = change
    } else {
      throw new ApiError(400, 'BAD_REQUEST', `Attribute "${key}" must be text, a number or null.`)
    }
  }

  return changes
}

// Edits one item, addressed by position, changing its value, its attributes, or both.
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const { documentId } = await context.params
    const body = (await request.json()) as {
      index?: unknown
      value?: unknown
      attributes?: unknown
    }

    if (typeof body.index !== 'number' || !Number.isInteger(body.index) || body.index < 0) {
      throw new ApiError(400, 'BAD_REQUEST', 'index must be a non-negative integer.')
    }

    if (body.value === undefined && body.attributes === undefined) {
      throw new ApiError(400, 'BAD_REQUEST', 'Provide a value, attributes, or both.')
    }

    const document = await updateDocumentExtractedItem({
      documentId,
      userId: user.id,
      index: body.index,
      value: body.value === undefined ? undefined : readFiniteNumber(body.value, 'value'),
      attributes:
        body.attributes === undefined ? undefined : readAttributeChanges(body.attributes),
    })

    return successResponse({ document })
  } catch (error) {
    return handleRouteError(error)
  }
}

// Adds a manually entered row as an item.
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const { documentId } = await context.params
    const body = (await request.json()) as {
      label?: unknown
      value?: unknown
      attributes?: unknown
    }

    if (typeof body.label !== 'string' || !body.label.trim()) {
      throw new ApiError(400, 'BAD_REQUEST', 'label is required.')
    }

    const document = await addDocumentExtractedItem({
      documentId,
      userId: user.id,
      label: body.label.trim(),
      value: readFiniteNumber(body.value, 'value'),
      attributes: toItemAttributes(body.attributes),
    })

    return successResponse({ document })
  } catch (error) {
    return handleRouteError(error)
  }
}
