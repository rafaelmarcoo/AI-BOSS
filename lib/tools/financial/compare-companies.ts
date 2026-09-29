import { z } from 'zod'
import { formatComparison } from '@/lib/company-analysis/format'
import { findCompany, findPeers } from '@/lib/company-analysis/lookup'
import { listVisibleCompanies } from '@/lib/company-analysis/persistence'
import { compareCompanies } from '@/lib/company-analysis/statement-analysis'
import { loadCompany, lookupFailureMessage } from '@/lib/company-analysis/tool-support'
import type { StructuredTool } from '@/lib/tools/contracts'

const inputSchema = z.object({
  company: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .describe('The company being analysed, for example "Ressett".'),
  competitor: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .optional()
    .describe("The company to compare against. Omit it to use the company's competitor on record."),
})

type CompareCompaniesInput = z.infer<typeof inputSchema>

export function createCompareCompaniesTool(
  userId: string
): StructuredTool<CompareCompaniesInput, string> {
  return {
    name: 'compare_companies',
    description:
      'Compare two analysed companies side by side from their published annual statements: size (only when both report in the same currency), growth, and every CIMA ratio, naming the stronger company where one direction is better. Omit competitor to compare a company with its competitor on record, for example Ressett with Fixxupp.',
    inputSchema,
    async handler({ company: firstQuery, competitor: secondQuery }) {
      const companies = await listVisibleCompanies(userId)

      const first = findCompany(companies, firstQuery)
      if (first.status !== 'found') return lookupFailureMessage(firstQuery, first, companies)

      let second
      if (secondQuery) {
        const found = findCompany(companies, secondQuery)
        if (found.status !== 'found') return lookupFailureMessage(secondQuery, found, companies)
        second = found.company
      } else {
        const peers = findPeers(companies, first.company)
        if (peers.length === 0) {
          return `${first.company.name} has no competitor on record. Ask the user which company to compare it with: ${companies
            .filter((company) => company.id !== first.company.id)
            .map((company) => company.name)
            .join(', ')}.`
        }
        if (peers.length > 1) {
          return `${first.company.name} has several competitors on record: ${peers.map((peer) => peer.name).join(', ')}. Ask the user which one to compare with.`
        }
        second = peers[0]
      }

      if (second.id === first.company.id) {
        return 'Both names refer to the same company. Ask the user which other company to compare with.'
      }

      const [a, b] = await Promise.all([loadCompany(first.company), loadCompany(second)])
      if (a.statements.years.length === 0 || b.statements.years.length === 0) {
        return `Statements are missing for ${a.statements.years.length === 0 ? first.company.name : second.name}, so the comparison cannot be made.`
      }

      return formatComparison(compareCompanies(a.statements, b.statements), a.context, b.context)
    },
  }
}
