import { NextRequest } from 'next/server'
import { ApiError } from '@/lib/api/errors'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { readJsonBody } from '@/lib/api/validation'
import { requireAuthenticatedUser } from '@/lib/auth'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { RunwayInputSchema, calculateRunway } from '@/lib/calculations/runway'

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)

    const body = await readJsonBody(request)

    const parsed = RunwayInputSchema.safeParse(body)
    if (!parsed.success) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Invalid runway inputs.',
        parsed.error.flatten().fieldErrors
      )
    }

    const result = calculateRunway(parsed.data)
    const { cash, ar, ap, burn } = parsed.data

    // Persist the calculation as a manual financial snapshot so the dashboard
    // and future features can read the latest runway without recalculating
    const supabase = createAdminSupabaseClient()
    const { error } = await supabase.from('financial_snapshots').insert({
      user_id: user.id,
      snapshot_date: new Date().toISOString(),
      cash_balance: cash,
      accounts_receivable: ar,
      accounts_payable: ap,
      burn_rate: burn,
      runway_months: result.runway_months,
      // monthly_revenue and monthly_expenses are not available from this
      // endpoint — set to 0 until Xero integration provides real values
      monthly_revenue: 0,
      monthly_expenses: 0,
      data_source: 'manual',
      raw_data: parsed.data,
    })

    if (error) {
      throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to save financial snapshot.')
    }

    return successResponse(result)
  } catch (error) {
    return handleRouteError(error)
  }
}
