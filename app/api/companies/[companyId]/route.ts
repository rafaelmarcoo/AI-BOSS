import { NextRequest } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { assertCompanyId } from '@/lib/company-analysis/company-id'
import { validateCompanyDetails } from '@/lib/company-analysis/company-details'
import { deleteUserCompany, updateUserCompany } from '@/lib/company-analysis/persistence'
import {
  assertReadyToSave,
  readStatementFile,
  reviewStatementUpload,
} from '@/lib/company-analysis/statement-upload'
import type { StatementYear } from '@/lib/company-analysis/statement-analysis'

interface RouteContext {
  params: Promise<{ companyId: string }>
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const companyId = assertCompanyId(
      (await context.params).companyId,
      "Couldn't find that company. You can only edit companies you added."
    )
    const formData = await request.formData()
    const details = validateCompanyDetails(formData)

    let years: StatementYear[] | null = null
    let fileName: string | null = null
    const upload = formData.get('file')
    if (upload !== null) {
      const file = readStatementFile(upload)
      const review = await reviewStatementUpload(file)
      assertReadyToSave(review, details.confirmedChecks)
      years = review.years
      fileName = file.name
    }

    const company = await updateUserCompany({ userId: user.id, companyId, details, years, fileName })
    return successResponse({ company }, undefined, `${company.name} was updated.`)
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const { companyId } = await context.params

    assertCompanyId(companyId, "Couldn't find that company. You can only delete companies you added.")

    await deleteUserCompany(user.id, companyId)
    return successResponse({ companyId }, undefined, 'Company deleted.')
  } catch (error) {
    return handleRouteError(error)
  }
}
