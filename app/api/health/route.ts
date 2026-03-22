import { successResponse, handleRouteError } from '@/lib/api/responses'

export async function GET() {
  try {
    return successResponse({
      status: 'ok',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
