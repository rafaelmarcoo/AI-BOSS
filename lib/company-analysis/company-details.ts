import { ApiError } from '@/lib/api/errors'
import { normalizeCompanyName } from '@/lib/company-analysis/lookup'
import type { AnalysedCompany } from '@/types/database'

const AMOUNT_SCALES = ['units', 'thousands', 'millions'] as const
export type AmountScale = (typeof AMOUNT_SCALES)[number]

export interface CompanyDetails {
  name: string
  industry: string | null
  currency: string
  amountsIn: AmountScale
  competitorOf: string | null
  confirmedChecks: boolean
}

function text(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

export function validateCompanyDetails(formData: FormData): CompanyDetails {
  const details: Record<string, string> = {}

  const name = text(formData, 'name')
  if (!name || name.length > 120) details.name = 'Enter a company name (up to 120 characters).'

  const industry = text(formData, 'industry')
  if (industry.length > 120) details.industry = 'Industry can be up to 120 characters.'

  const currency = text(formData, 'currency').toUpperCase()
  if (!/^[A-Z]{1,3}\$?$/.test(currency)) {
    details.currency = 'Enter a currency, like NZD, AUD or USD.'
  }

  const amountsIn = text(formData, 'amountsIn')
  if (!(AMOUNT_SCALES as readonly string[]).includes(amountsIn)) {
    details.amountsIn = 'Choose units, thousands or millions.'
  }

  if (Object.keys(details).length > 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Some details are missing or wrong. Check the boxes marked in red.', details)
  }

  return {
    name,
    industry: industry || null,
    currency,
    amountsIn: amountsIn as AmountScale,
    competitorOf: text(formData, 'competitorOf') || null,
    confirmedChecks: text(formData, 'confirmedChecks') === 'true',
  }
}

export function planNewCompany(params: {
  details: CompanyDetails
  visibleCompanies: AnalysedCompany[]
  newGroupId: string
  editingId?: string
}) {
  const { details, visibleCompanies } = params
  const wanted = normalizeCompanyName(details.name)
  const clash = visibleCompanies.find(
    (company) => company.id !== params.editingId && normalizeCompanyName(company.name) === wanted
  )

  if (clash) {
    throw new ApiError(
      409,
      'CONFLICT',
      clash.user_id
        ? `You already have a company called ${clash.name}.`
        : `${clash.name} is already a case study. Pick a different name.`
    )
  }

  let peerGroup = params.newGroupId
  if (details.competitorOf && details.competitorOf === params.editingId) {
    throw new ApiError(400, 'VALIDATION_ERROR', "A company can't compete with itself.", {
      competitorOf: 'Pick another company from the list.',
    })
  }
  if (details.competitorOf) {
    const competitor = visibleCompanies.find((company) => company.id === details.competitorOf)
    if (!competitor?.peer_group) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'That competitor no longer exists.', {
        competitorOf: 'Pick another company from the list.',
      })
    }
    peerGroup = competitor.peer_group
  }

  return { peerGroup }
}
