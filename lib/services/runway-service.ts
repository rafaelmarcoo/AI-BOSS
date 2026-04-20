import { ApiError } from '@/lib/api/errors'
import { createAdminSupabaseClient } from '@/lib/supabase'
import {
  calculateRunway,
  RunwayInput,
  RunwayInputSchema,
  RunwayResult,
} from '@/lib/calculations/runway'

export interface StoredRunwayResult {
  result: RunwayResult
  snapshotStored: true
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

export async function calculateAndStoreRunwaySnapshot(
  userId: string,
  input: RunwayInput
): Promise<StoredRunwayResult> {
  const result = calculateRunway(input)
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase.from('financial_snapshots').insert({
    user_id: userId,
    snapshot_date: new Date().toISOString(),
    cash_balance: input.cash,
    accounts_receivable: input.ar,
    accounts_payable: input.ap,
    burn_rate: input.burn,
    runway_months: result.runway_months,
    monthly_revenue: 0,
    monthly_expenses: 0,
    data_source: 'manual',
    raw_data: input,
  })

  if (error) {
    throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to save financial snapshot.')
  }

  return {
    result,
    snapshotStored: true,
  }
}
