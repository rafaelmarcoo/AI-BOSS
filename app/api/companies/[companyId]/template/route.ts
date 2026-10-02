import { NextRequest } from 'next/server'
import { ApiError } from '@/lib/api/errors'
import { handleRouteError } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import { assertCompanyId } from '@/lib/company-analysis/company-id'
import { listVisibleCompanies } from '@/lib/company-analysis/persistence'
import { buildStatementTemplate } from '@/lib/company-analysis/statement-template'
import { loadCompany } from '@/lib/company-analysis/tool-support'

interface RouteContext {
  params: Promise<{ companyId: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const companyId = assertCompanyId((await context.params).companyId)

    const company = (await listVisibleCompanies(user.id)).find((candidate) => candidate.id === companyId)
    if (!company) throw new ApiError(404, 'NOT_FOUND', "Couldn't find that company.")

    const { statements } = await loadCompany(company)
    const fileName = `${company.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'company'}-statements.csv`

    return new Response(buildStatementTemplate(statements.years), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
