import { ApiError } from '@/lib/api/errors'
import { randomUUID } from 'node:crypto'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { planNewCompany, type CompanyDetails } from '@/lib/company-analysis/company-details'
import { findPeers } from '@/lib/company-analysis/lookup'
import { linesFromStatements, type StatementYear } from '@/lib/company-analysis/statement-analysis'
import type { AnalysedCompany, CompanyStatementLine } from '@/types/database'
import {
  toStatementLineRows,
  type CaseStudyCompany,
} from '@/lib/company-analysis/cima-case-studies'

export async function saveSharedCaseStudy(company: CaseStudyCompany) {
  const supabase = createAdminSupabaseClient()
  const details = {
    name: company.name,
    industry: company.industry,
    peer_group: company.peerGroup,
    currency: company.currency,
    amounts_in: company.amountsIn,
    description: company.description,
    source: company.source,
  }

  const { data: existing, error: findError } = await supabase
    .from('analysed_companies')
    .select('id')
    .is('user_id', null)
    .eq('name', company.name)
    .maybeSingle()

  if (findError) {
    throw new Error(`Could not look up ${company.name}: ${findError.message}`)
  }

  let companyId: string

  if (existing) {
    const { error } = await supabase
      .from('analysed_companies')
      .update(details)
      .eq('id', existing.id)

    if (error) throw new Error(`Could not update ${company.name}: ${error.message}`)
    companyId = existing.id
  } else {
    const { data, error } = await supabase
      .from('analysed_companies')
      .insert(details)
      .select('id')
      .single()

    if (error || !data) {
      throw new Error(`Could not create ${company.name}: ${error?.message ?? 'no row returned'}`)
    }
    companyId = data.id
  }

  const { error: deleteError } = await supabase
    .from('company_statement_lines')
    .delete()
    .eq('company_id', companyId)

  if (deleteError) {
    throw new Error(`Could not clear lines for ${company.name}: ${deleteError.message}`)
  }

  const rows = toStatementLineRows(company).map((row) => ({ ...row, company_id: companyId }))
  const { error: insertError } = await supabase.from('company_statement_lines').insert(rows)

  if (insertError) {
    throw new Error(`Could not save lines for ${company.name}: ${insertError.message}`)
  }

  return { companyId, lineCount: rows.length }
}
export async function listVisibleCompanies(userId: string): Promise<AnalysedCompany[]> {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('analysed_companies')
    .select('*')
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .order('name')

  if (error) {
    throw new ApiError(500, 'INTERNAL_ERROR', 'Could not load analysed companies.')
  }

  return (data ?? []) as AnalysedCompany[]
}

/** Statement lines for a company already confirmed visible to the user. */
export async function listStatementLines(companyId: string): Promise<CompanyStatementLine[]> {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('company_statement_lines')
    .select('*')
    .eq('company_id', companyId)

  if (error) {
    throw new ApiError(500, 'INTERNAL_ERROR', 'Could not load company statements.')
  }

  return (data ?? []) as CompanyStatementLine[]
}

export async function createUserCompany(params: {
  userId: string
  details: CompanyDetails
  years: StatementYear[]
  fileName: string
}): Promise<AnalysedCompany> {
  const visibleCompanies = await listVisibleCompanies(params.userId)
  const { peerGroup } = planNewCompany({
    details: params.details,
    visibleCompanies,
    newGroupId: `user-${randomUUID()}`,
  })

  const supabase = createAdminSupabaseClient()
  const { data: company, error } = await supabase
    .from('analysed_companies')
    .insert({
      user_id: params.userId,
      name: params.details.name,
      industry: params.details.industry,
      peer_group: peerGroup,
      currency: params.details.currency,
      amounts_in: params.details.amountsIn,
      description: null,
      source: `Uploaded by you: ${params.fileName}`,
    })
    .select('*')
    .single()

  if (error || !company) {
    if (error?.code === '23505') {
      throw new ApiError(409, 'CONFLICT', `You already have a company called ${params.details.name}.`)
    }
    throw new ApiError(500, 'INTERNAL_ERROR', 'Could not save the company.')
  }

  const rows = linesFromStatements(params.years).map((row) => ({ ...row, company_id: company.id }))
  const { error: linesError } = await supabase.from('company_statement_lines').insert(rows)

  if (linesError) {
    await supabase
      .from('analysed_companies')
      .delete()
      .eq('id', company.id)
      .eq('user_id', params.userId)
    throw new ApiError(500, 'INTERNAL_ERROR', 'Could not save the company statements.')
  }

  return company as AnalysedCompany
}

export async function deleteUserCompany(userId: string, companyId: string) {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('analysed_companies')
    .delete()
    .eq('id', companyId)
    .eq('user_id', userId)
    .select('id')

  if (error) throw new ApiError(500, 'INTERNAL_ERROR', 'Could not delete the company.')
  if (!data || data.length === 0) {
    throw new ApiError(404, 'NOT_FOUND', 'Company not found. Only companies you added can be deleted.')
  }
}

export interface CompanySummary {
  id: string
  name: string
  industry: string | null
  currency: string
  amountsIn: AnalysedCompany['amounts_in']
  source: string
  isOwn: boolean
  competitors: string[]
}

export async function listCompanySummaries(userId: string): Promise<CompanySummary[]> {
  const companies = await listVisibleCompanies(userId)
  return companies.map((company) => ({
    id: company.id,
    name: company.name,
    industry: company.industry,
    currency: company.currency,
    amountsIn: company.amounts_in,
    source: company.source,
    isOwn: company.user_id === userId,
    competitors: findPeers(companies, company).map((peer) => peer.name),
  }))
}
