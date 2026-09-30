import { NextRequest } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { validateCompanyDetails } from '@/lib/company-analysis/company-details'
import { createUserCompany, listCompanySummaries } from '@/lib/company-analysis/persistence'
import {
  assertReadyToSave,
  readStatementFile,
  reviewStatementUpload,
} from '@/lib/company-analysis/statement-upload'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const companies = await listCompanySummaries(user.id)

    return successResponse({ companies })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const formData = await request.formData()
    const file = readStatementFile(formData.get('file'))
    const details = validateCompanyDetails(formData)
    const review = await reviewStatementUpload(file)
    assertReadyToSave(review, details.confirmedChecks)

    const company = await createUserCompany({
      userId: user.id,
      details,
      years: review.years,
      fileName: file.name,
    })

    return successResponse({ company }, { status: 201 }, `${company.name} was added.`)
  } catch (error) {
    return handleRouteError(error)
  }
}
