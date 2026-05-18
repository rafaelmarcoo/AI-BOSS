import { ApiError } from '@/lib/api/errors'
import {
  calculateRunway,
  RunwayInput,
  RunwayInputSchema,
  RunwayResult,
} from '@/lib/calculations/runway'

export function calculateRunwayResult(input: RunwayInput): RunwayResult {
  return calculateRunway(input)
}

export function validateRunwayInput(input: unknown): RunwayInput {
  const parsed = RunwayInputSchema.safeParse(input)

  if (!parsed.success) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'Invalid runway inputs.',
      parsed.error.flatten().fieldErrors
    )
  }

  return parsed.data
}
