import { NextRequest } from 'next/server'
import { ApiError } from '@/lib/api/errors'
import { handleRouteError } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import { combineSources, rowsFromSources } from '@/lib/financial-data/combine-sources'
import { listFinancialMetricObservations } from '@/lib/financial-data/persistence'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const rows = await listFinancialMetricObservations(user.id)
    // ?source=a.csv&source=b.csv limits it to the files the user chose; none means all.
    const chosen = request.nextUrl.searchParams.getAll('source')
    const combined = combineSources(chosen.length > 0 ? rowsFromSources(rows, chosen) : rows)

    if (combined.rowCount === 0) {
      throw new ApiError(404, 'NOT_FOUND', 'There are no confirmed figures to combine yet.')
    }

    const today = new Date().toISOString().slice(0, 10)
    return new Response(combined.csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="ai-boss-combined-data-${today}.csv"`,
      },
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
