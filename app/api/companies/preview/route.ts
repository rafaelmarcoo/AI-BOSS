import { NextRequest } from 'next/server'
import { ApiError } from '@/lib/api/errors'
import { requireAuthenticatedUser } from '@/lib/auth'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { assertCompanyId } from '@/lib/company-analysis/company-id'
import { listVisibleCompanies } from '@/lib/company-analysis/persistence'
import type { StatementYear } from '@/lib/company-analysis/statement-analysis'
import { readStatementFile, reviewStatementUpload } from '@/lib/company-analysis/statement-upload'
import { loadCompany } from '@/lib/company-analysis/tool-support'

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const formData = await request.formData()
    const file = readStatementFile(formData.get('file'))
    const review = await reviewStatementUpload(file)

    let saved: StatementYear[] | null = null
    const companyIdValue = formData.get('companyId')
    if (typeof companyIdValue === 'string' && companyIdValue) {
      const companyId = assertCompanyId(companyIdValue)
      const company = (await listVisibleCompanies(user.id)).find(
        (candidate) => candidate.id === companyId && candidate.user_id === user.id
      )
      if (!company) {
        throw new ApiError(404, 'NOT_FOUND', "Couldn't find that company. You can only update companies you added.")
      }
      saved = (await loadCompany(company)).statements.years
    }

    return successResponse({ review, saved })
  } catch (error) {
    return handleRouteError(error)
  }
}
