import { NextRequest } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { readStatementFile, reviewStatementUpload } from '@/lib/company-analysis/statement-upload'

export async function POST(request: NextRequest) {
  try {
    await requireAuthenticatedUser(request)
    const formData = await request.formData()
    const file = readStatementFile(formData.get('file'))
    const review = await reviewStatementUpload(file)

    return successResponse({ review })
  } catch (error) {
    return handleRouteError(error)
  }
}
