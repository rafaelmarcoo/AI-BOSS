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
    throw new ApiError(500, 'INTERNAL_ERROR', 'Could not save the figures, so nothing was saved. Please try again.')
  }

  return company as AnalysedCompany
}

export async function updateUserCompany(params: {
  userId: string
  companyId: string
  details: CompanyDetails
  years: StatementYear[] | null
  fileName: string | null
}): Promise<AnalysedCompany> {
  const visibleCompanies = await listVisibleCompanies(params.userId)
  const current = visibleCompanies.find(
    (company) => company.id === params.companyId && company.user_id === params.userId
  )
  if (!current) {
    throw new ApiError(404, 'NOT_FOUND', "Couldn't find that company. You can only edit companies you added.")
  }

  const { peerGroup } = planNewCompany({
    details: params.details,
    visibleCompanies,
    newGroupId: `user-${randomUUID()}`,
    editingId: params.companyId,
  })

  const supabase = createAdminSupabaseClient()
  const { data: company, error } = await supabase
    .from('analysed_companies')
    .update({
      name: params.details.name,
      industry: params.details.industry,
      peer_group: peerGroup,
      currency: params.details.currency,
      amounts_in: params.details.amountsIn,
    })
    .eq('id', params.companyId)
    .eq('user_id', params.userId)
    .select('*')
    .single()

  if (error || !company) {
    if (error?.code === '23505') {
      throw new ApiError(409, 'CONFLICT', `You already have a company called ${params.details.name}.`)
    }
    throw new ApiError(500, 'INTERNAL_ERROR', 'Could not save the changes.')
  }

  if (!params.years) return company as AnalysedCompany

  await replaceStatementLines(params.companyId, params.years)

  const { data: updated } = await supabase
    .from('analysed_companies')
    .update({ source: `Uploaded by you: ${params.fileName}` })
    .eq('id', params.companyId)
    .eq('user_id', params.userId)
    .select('*')
    .single()

  return (updated ?? company) as AnalysedCompany
}

async function replaceStatementLines(companyId: string, years: StatementYear[]) {
  const supabase = createAdminSupabaseClient()
  const previous = await listStatementLines(companyId)

  const { error: deleteError } = await supabase.from('company_statement_lines').delete().eq('company_id', companyId)
  if (deleteError) {
    throw new ApiError(500, 'INTERNAL_ERROR', 'Could not replace the figures, so the old ones were kept. Please try again.')
  }

  const rows = linesFromStatements(years).map((row) => ({ ...row, company_id: companyId }))
  const { error: insertError } = await supabase.from('company_statement_lines').insert(rows)
  if (!insertError) return

  const restore = previous.map((line) => ({
    company_id: line.company_id,
    fiscal_year_end: line.fiscal_year_end,
    line_key: line.line_key,
    segment: line.segment,
    value: line.value,
    source_page: line.source_page,
  }))
  const { error: restoreError } = await supabase.from('company_statement_lines').insert(restore)
  if (restoreError) {
    console.error('Could not restore company figures after a failed replace', { companyId, restoreError })
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Could not save the new figures, and the old figures could not be put back. Please upload the file again.'
    )
  }
  throw new ApiError(500, 'INTERNAL_ERROR', 'Could not save the new figures, so the old ones were kept. Please try again.')
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
    throw new ApiError(404, 'NOT_FOUND', 'Couldn\'t find that company. You can only delete companies you added.')
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

export async function listCompanyNamesForRouting(userId: string): Promise<string[]> {
  try {
    const companies = await listVisibleCompanies(userId)
    return companies.map((company) => company.name)
  } catch (error) {
    console.error('Could not load company names for routing', error)
    return []
  }
}
