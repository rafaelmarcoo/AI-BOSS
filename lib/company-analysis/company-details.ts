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
  if (!name || name.length > 120) details.name = 'Enter a company name of up to 120 characters.'

  const industry = text(formData, 'industry')
  if (industry.length > 120) details.industry = 'Keep the industry to 120 characters or fewer.'

  const currency = text(formData, 'currency').toUpperCase()
  if (!/^[A-Z]{1,3}\$?$/.test(currency)) {
    details.currency = 'Choose a currency, such as NZD, AUD, USD, or a case-study currency such as D$.'
  }

  const amountsIn = text(formData, 'amountsIn')
  if (!(AMOUNT_SCALES as readonly string[]).includes(amountsIn)) {
    details.amountsIn = 'Choose whether figures are in units, thousands or millions.'
  }

  if (Object.keys(details).length > 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Some company details are missing or invalid.', details)
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
}) {
  const { details, visibleCompanies } = params
  const wanted = normalizeCompanyName(details.name)
  const clash = visibleCompanies.find((company) => normalizeCompanyName(company.name) === wanted)

  if (clash) {
    throw new ApiError(
      409,
      'CONFLICT',
      clash.user_id
        ? `You already have a company called ${clash.name}.`
        : `${clash.name} is already available as a case study. Choose a different name.`
    )
  }

  let peerGroup = params.newGroupId
  if (details.competitorOf) {
    const competitor = visibleCompanies.find((company) => company.id === details.competitorOf)
    if (!competitor?.peer_group) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'The chosen competitor could not be found.', {
        competitorOf: 'Choose a competitor from the list.',
      })
    }
    peerGroup = competitor.peer_group
  }

  return { peerGroup }
}
