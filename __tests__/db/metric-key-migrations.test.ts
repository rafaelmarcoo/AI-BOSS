import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { FINANCIAL_METRIC_KEYS } from '@/lib/financial-data/metric-keys'
import { STATEMENT_LINE_KEYS } from '@/lib/company-analysis/statement-lines'

// Comments are stripped because 020 annotates its list, and a comment such as
// "(original seven)" would otherwise close the list early.
function readMigration(name: string) {
  return readFileSync(join(process.cwd(), 'db/migrations', name), 'utf8')
    .replace(/--[^\n]*/g, '')
}

/** Returns the quoted keys inside the first `<marker> (` list after `anchor`. */
function keyListAfter(sql: string, anchor: string, marker: string) {
  const anchorIndex = sql.indexOf(anchor)
  if (anchorIndex === -1) throw new Error(`"${anchor}" not found`)
  const listStart = sql.indexOf(`${marker} (`, anchorIndex)
  if (listStart === -1) throw new Error(`"${marker} (" not found after "${anchor}"`)
  const listEnd = sql.indexOf(')', listStart + marker.length + 2)
  // Sorted, because order inside a SQL IN list carries no meaning.
  return [...sql.slice(listStart, listEnd).matchAll(/'([a-z_]+)'/g)]
    .map(([, key]) => key)
    .sort()
}

const APP_KEYS = [...FINANCIAL_METRIC_KEYS].sort()

// The app, the observations table and the document review flow each keep a
// list of metric keys. When the app gained six CIMA metrics, the review flow's
// two copies were missed, and uploads of those metrics were rejected at review
// with nothing in git or the unit tests to show it. These tests fail as soon
// as any database list drifts from the app's.
describe('metric key migrations', () => {
  const observations = readMigration('020_extend_financial_metric_keys.sql')
  const review = readMigration('021_extend_document_review_metric_keys.sql')

  it('lets financial observations store every metric the app supports', () => {
    expect(
      keyListAfter(observations, 'ADD CONSTRAINT', 'metric_key IN')
    ).toEqual(APP_KEYS)
  })

  it('lets review candidates hold every metric the app supports', () => {
    expect(
      keyListAfter(review, 'ADD CONSTRAINT', 'metric_key IN')
    ).toEqual(APP_KEYS)
  })

  it('lets the confirmation step publish every metric the app supports', () => {
    expect(
      keyListAfter(
        review,
        'CREATE OR REPLACE FUNCTION public.confirm_document_extraction',
        'review.metric_key NOT IN'
      )
    ).toEqual(APP_KEYS)
  })

  it('stores exactly the statement lines the app knows about', () => {
    expect(
      keyListAfter(
        readMigration('022_analysed_companies.sql'),
        'company_statement_lines_line_key_check',
        'line_key IN'
      )
    ).toEqual([...STATEMENT_LINE_KEYS].sort())
  })

  it('keeps the confirmation function identical to 016 apart from the key list', () => {
    const functionOf = (sql: string) =>
      sql
        .slice(sql.indexOf('CREATE OR REPLACE FUNCTION'))
        .replace(/review\.metric_key NOT IN \([^)]*\)/, 'KEY_LIST')
        .replace(/\r\n/g, '\n')

    expect(functionOf(review)).toBe(
      functionOf(readMigration('016_runway_currency_unit.sql'))
    )
  })
})
