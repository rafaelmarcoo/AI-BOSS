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
    throw new ApiError(400, 'VALIDATION_ERROR', `${name} must be a finite number.`)
  }
  return value
}

function readAttributeChanges(value: unknown): AttributeChanges {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'attributes must be an object.')
  }

  const changes: AttributeChanges = {}
  for (const [key, change] of Object.entries(value as Record<string, unknown>)) {
    if (change === null || typeof change === 'string') {
      changes[key] = change
    } else if (typeof change === 'number' && Number.isFinite(change)) {
      changes[key] = change
    } else {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        `Attribute "${key}" must be text, a number, or null.`
      )
    }
  }
  return changes
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const { documentId } = await context.params
    const body = (await request.json()) as {
      index?: unknown
      value?: unknown
      attributes?: unknown
    }

    if (
      typeof body.index !== 'number' ||
      !Number.isInteger(body.index) ||
      body.index < 0
    ) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'index must be a non-negative integer.'
      )
    }
    if (body.value === undefined && body.attributes === undefined) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Provide a value, attributes, or both.'
      )
    }

    const document = await updateDocumentExtractedItem({
      documentId,
      requesterId: user.id,
      index: body.index,
      ...(body.value === undefined
        ? {}
        : { value: readFiniteNumber(body.value, 'value') }),
      ...(body.attributes === undefined
        ? {}
        : { attributes: readAttributeChanges(body.attributes) }),
    })

    return successResponse({ document })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const { documentId } = await context.params
    const body = (await request.json()) as {
      label?: unknown
      value?: unknown
      attributes?: unknown
    }

    if (
      typeof body.label !== 'string' ||
      !body.label.trim() ||
      body.label.trim().length > 120
    ) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'label must contain between 1 and 120 characters.'
      )
    }

    const document = await addDocumentExtractedItem({
      documentId,
      requesterId: user.id,
      label: body.label.trim(),
      value:
        body.value === undefined
          ? null
          : readFiniteNumber(body.value, 'value'),
      attributes: toItemAttributes(body.attributes),
    })

    return successResponse({ document })
  } catch (error) {
    return handleRouteError(error)
  }
}
