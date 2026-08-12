import { handleRouteError, successResponse } from '@/lib/api/responses'
import { getJoinableCompanyNames } from '@/lib/companies'

export async function GET() {
  try {
    return successResponse({ companies: await getJoinableCompanyNames() })
  } catch (error) {
    return handleRouteError(error)
  }
}
