import { z } from 'zod'
import { formatCompanyAnalysis } from '@/lib/company-analysis/format'
import { findCompany } from '@/lib/company-analysis/lookup'
import { listVisibleCompanies } from '@/lib/company-analysis/persistence'
import { analyseCompany } from '@/lib/company-analysis/statement-analysis'
import { loadCompany, lookupFailureMessage } from '@/lib/company-analysis/tool-support'
import type { StructuredTool } from '@/lib/tools/contracts'

const inputSchema = z.object({
  company: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .describe('Name of the company to analyse, for example "Trimayr".'),
})

type AnalyseCompanyInput = z.infer<typeof inputSchema>

export function createAnalyseCompanyTool(
  userId: string
): StructuredTool<AnalyseCompanyInput, string> {
  return {
    name: 'analyse_company',
    description:
      "Full CIMA-style analysis of one company's published annual statements: growth, profitability, liquidity, efficiency, gearing, cost structure, dividends and revenue streams, each with its working and a comparison with the prior year. Use it for any question about a named analysed company, such as the CIMA case studies. It never covers the user's own business.",
    inputSchema,
    async handler({ company: query }) {
      const companies = await listVisibleCompanies(userId)
      const result = findCompany(companies, query)
      if (result.status !== 'found') return lookupFailureMessage(query, result, companies)

      const { statements, context } = await loadCompany(result.company)
      if (statements.years.length === 0) {
        return `No statements are stored for ${result.company.name}, so it cannot be analysed.`
      }

      return formatCompanyAnalysis(analyseCompany(statements), context)
    },
  }
}
