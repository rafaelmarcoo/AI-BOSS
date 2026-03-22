import { ApiError } from '@/lib/api/errors'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { createAdminSupabaseClient } from '@/lib/supabase'

export async function GET() {
  try {
    const supabase = createAdminSupabaseClient()
    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })

    if (error) {
      throw new ApiError(500, 'INTERNAL_ERROR', error.message)
    }

    return successResponse(
      {
        userCount: count ?? 0,
        timestamp: new Date().toISOString(),
      },
      undefined,
      'Test DB connection successful.'
    )
  } catch (error) {
    return handleRouteError(error)
  }
}
