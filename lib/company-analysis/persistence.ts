import { createAdminSupabaseClient } from '@/lib/supabase'
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
