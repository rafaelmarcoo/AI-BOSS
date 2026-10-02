import { CIMA_CASE_STUDIES } from '@/lib/company-analysis/cima-case-studies'
import { buildExampleTemplate } from '@/lib/company-analysis/example-template'
import { statementsFromCaseStudy } from '@/lib/company-analysis/statement-analysis'
import { parseStatementCsv } from '@/lib/company-analysis/statement-csv'
import { STATEMENT_LINE_KEYS, STATEMENT_LINE_LABELS } from '@/lib/company-analysis/statement-lines'
import { buildBlankTemplate } from '@/lib/company-analysis/statement-template'

const encode = (text: string) => new TextEncoder().encode(text)

describe('blank template', () => {
  const text = buildBlankTemplate()

  it('lists every line the reader knows, plus a revenue stream example', () => {
    const labels = text.trim().split('\n').slice(1).map((line) => line.match(/^"([^"]*)"/)?.[1] ?? line.split(',')[0])
    const companyKeys = STATEMENT_LINE_KEYS.filter((key) => key !== 'segment_revenue' && key !== 'segment_direct_costs')

    expect(labels).toEqual([
      ...companyKeys.map((key) => STATEMENT_LINE_LABELS[key]),
      'Revenue stream: Stream name',
      'Direct costs: Stream name',
    ])
  })

  it('recognises every row once the year headings are filled in', () => {
    const filled = text.replace('Latest year end (YYYY-MM-DD)', '2025-03-31').replace('Previous year end (YYYY-MM-DD)', '2024-03-31')
    const result = parseStatementCsv(encode(filled))

    expect(result.unrecognised).toEqual([])
    expect(result.errors).toEqual(['The 2025-03-31 column is empty.', 'The 2024-03-31 column is empty.'])
  })

  it('refuses the placeholder year headings if they are left unchanged', () => {
    const result = parseStatementCsv(encode(text))
    expect(result.errors.join(' ')).toContain('"Latest year end (YYYY-MM-DD)" isn\'t a date')
  })
})

describe('example template', () => {
  it("is Ressett's statements and reads back cleanly", () => {
    const ressett = statementsFromCaseStudy(CIMA_CASE_STUDIES.find((company) => company.name === 'Ressett')!)
    const result = parseStatementCsv(encode(buildExampleTemplate()))

    expect(result.errors).toEqual([])
    expect(result.unrecognised).toEqual([])
    expect(result.years).toEqual(ressett.years)
  })
})
