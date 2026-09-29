import { z } from 'zod'
import { findPeers } from '@/lib/company-analysis/lookup'
import { listVisibleCompanies } from '@/lib/company-analysis/persistence'
import type { StructuredTool } from '@/lib/tools/contracts'

export function createListAnalysedCompaniesTool(
  userId: string
): StructuredTool<Record<string, never>, string> {
  return {
    name: 'list_analysed_companies',
    description:
      "List the companies whose published annual statements can be analysed, such as the CIMA case-study companies, with each company's competitor. Use it when the user asks which companies are available or names a company you cannot find.",
    inputSchema: z.object({}),
    async handler() {
      const companies = await listVisibleCompanies(userId)
      if (companies.length === 0) return 'No analysed companies are available yet.'

      return [
        'Companies available for statement analysis:',
        ...companies.map((company) => {
          const peers = findPeers(companies, company).map((peer) => peer.name)
          return (
            `- ${company.name}${company.industry ? ` (${company.industry})` : ''}, ` +
            `reporting in ${company.currency} ${company.amounts_in}` +
            `${peers.length > 0 ? `; competitor: ${peers.join(', ')}` : ''}. ` +
            `Source: ${company.source}.`
          )
        }),
      ].join('\n')
    },
  }
}
