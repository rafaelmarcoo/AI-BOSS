import { z } from 'zod'
import {
  combinedCsvPath,
  combineSources,
  describeAvailableSources,
  describeCombinedSources,
  listCombinableSources,
  rowsFromSources,
} from '@/lib/financial-data/combine-sources'
import { listFinancialMetricObservations } from '@/lib/financial-data/persistence'
import type { StructuredTool } from '@/lib/tools/contracts'

export const COMBINED_CSV_DOWNLOAD_PATH = '/api/financial-data/combined-csv'

const CombineInputSchema = z.object({
  sources: z
    .array(z.string())
    .optional()
    .describe('File names the user chose to combine, exactly as the tool listed them. Omit to ask the user which files to combine.'),
  all: z.boolean().optional().describe('True only when the user asked to combine all of their files.'),
})

type CombineInput = z.infer<typeof CombineInputSchema>

export function createCombineFinancialSourcesTool(userId: string): StructuredTool<CombineInput, string> {
  return {
    name: 'combine_financial_sources',
    description:
      "Combine the user's confirmed figures from the uploaded files (and connected accounting apps) they choose into one CSV they can download and upload back as a single source. " +
      'Use this when the user asks to combine, merge or join their files or data into one file. ' +
      'Call it with no sources first unless the user already named the files or said "all": it lists the files so the user can choose. ' +
      'Then call it again with the chosen file names (map numbers to the names in the list) or all: true. ' +
      'The tool merges in code, reports clashes between files, and returns a download link. Give the user its text and link exactly as returned; never list, change or recalculate the figures yourself.',
    inputSchema: CombineInputSchema,
    async handler(input) {
      const rows = await listFinancialMetricObservations(userId)
      const available = listCombinableSources(rows)

      if (!input.all && (!input.sources || input.sources.length === 0)) {
        return describeAvailableSources(available)
      }

      if (input.all) {
        return describeCombinedSources(combineSources(rows), combinedCsvPath(COMBINED_CSV_DOWNLOAD_PATH, null))
      }

      const known = new Map(available.map((source) => [source.label.toLowerCase(), source.label]))
      const chosen = [...new Set((input.sources ?? []).map((name) => known.get(name.trim().toLowerCase())).filter((name): name is string => Boolean(name)))]
      const unknown = (input.sources ?? []).filter((name) => !known.has(name.trim().toLowerCase()))

      if (unknown.length > 0 || chosen.length < 2) {
        const problem = unknown.length > 0
          ? `I couldn't find ${unknown.map((name) => `"${name}"`).join(', ')}.`
          : 'Pick at least two files to combine.'
        return `${problem}\n\n${describeAvailableSources(available)}`
      }

      return describeCombinedSources(
        combineSources(rowsFromSources(rows, chosen)),
        combinedCsvPath(COMBINED_CSV_DOWNLOAD_PATH, chosen)
      )
    },
  }
}
