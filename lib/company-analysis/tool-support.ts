import type { AnalysedCompany } from '@/types/database'
import type { CompanyLookup } from '@/lib/company-analysis/lookup'
import { listStatementLines } from '@/lib/company-analysis/persistence'
import { statementsFromLines } from '@/lib/company-analysis/statement-analysis'

export function lookupFailureMessage(
  query: string,
  result: Exclude<CompanyLookup, { status: 'found' }>,
  companies: AnalysedCompany[]
) {
  if (result.status === 'ambiguous') {
    return `"${query}" matches several companies: ${result.matches.map((company) => company.name).join(', ')}. Ask the user which one they mean.`
  }
  const available = companies.map((company) => company.name).join(', ') || 'none'
  return `No analysed company is called "${query}". Available companies: ${available}. Never analyse, estimate or describe the finances of a company that is not in this list.`
}

export async function loadCompany(company: AnalysedCompany) {
  const lines = await listStatementLines(company.id)
  return {
    statements: statementsFromLines(
      { name: company.name, currency: company.currency, amountsIn: company.amounts_in },
      lines
    ),
    context: {
      company,
      pages: lines.flatMap((line) => (line.source_page === null ? [] : [line.source_page])),
    },
  }
}
