import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { FINANCIAL_METRIC_KEYS } from '@/lib/financial-data/metric-keys'
import { STATEMENT_LINE_KEYS } from '@/lib/company-analysis/statement-lines'

// Comments are stripped so prose cannot be mistaken for a SQL key list.
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
  const ratioMetrics = readMigration('030_financial_ratio_metrics.sql')

  it('lets financial observations store every metric the app supports', () => {
    expect(
      keyListAfter(
        ratioMetrics,
        'ALTER TABLE public.financial_metric_observations',
        'metric_key IN'
      )
    ).toEqual(APP_KEYS)
  })

  it('lets review candidates hold every metric the app supports', () => {
    expect(
      keyListAfter(
        ratioMetrics,
        'ALTER TABLE public.document_extraction_candidates',
        'metric_key IN'
      )
    ).toEqual(APP_KEYS)
  })

  it('lets the confirmation step publish every metric the app supports', () => {
    expect(
      keyListAfter(
        ratioMetrics,
        'CREATE OR REPLACE FUNCTION public.confirm_document_extraction',
        'review.metric_key NOT IN'
      )
    ).toEqual(APP_KEYS)
  })

  it('stores exactly the statement lines the app knows about', () => {
    expect(
      keyListAfter(
        readMigration('031_analysed_companies.sql'),
        'company_statement_lines_line_key_check',
        'line_key IN'
      )
    ).toEqual([...STATEMENT_LINE_KEYS].sort())
  })

  it('keeps the current company-admin confirmation boundary while widening the key list', () => {
    const functionOf = (sql: string) => {
      const start = sql.indexOf(
        'CREATE OR REPLACE FUNCTION public.confirm_document_extraction'
      )
      const grant = sql.indexOf(
        'GRANT EXECUTE ON FUNCTION public.confirm_document_extraction',
        start
      )
      const end = sql.indexOf('\n', grant)
      return sql
        .slice(start, end === -1 ? undefined : end + 1)
        .replace(/review\.metric_key NOT IN \([^)]*\)/, 'KEY_LIST')
        .replace(/\r\n/g, '\n')
    }

    expect(functionOf(ratioMetrics)).toBe(
      functionOf(readMigration('022_company_financial_review.sql'))
    )
  })

  it('keeps migration numbers unique through 032', () => {
    const migrationNumbers = readdirSync(join(process.cwd(), 'db/migrations'))
      .filter((name) => /^\d{3}_.+\.sql$/.test(name))
      .map((name) => name.slice(0, 3))

    expect(new Set(migrationNumbers).size).toBe(migrationNumbers.length)
    expect(migrationNumbers).toContain('032')
  })

  it('keeps uploaded companies private while shared case studies are read-only reference data', () => {
    const companies = readMigration('031_analysed_companies.sql')

    expect(companies).toContain('user_id IS NULL OR auth.uid() = user_id')
    expect(companies).toContain('WITH CHECK (auth.uid() = user_id)')
    expect(companies).toContain('company.user_id = auth.uid()')
    expect(companies).not.toContain('INSERT INTO public.analysed_companies')
  })

  it('can safely retry analysed-company policies and triggers', () => {
    const companies = readMigration('031_analysed_companies.sql')
    const createdPolicies = [...companies.matchAll(/CREATE POLICY "([^"]+)"/g)]
      .map(([, name]) => name)
      .sort()
    const droppedPolicies = [...companies.matchAll(/DROP POLICY IF EXISTS "([^"]+)"/g)]
      .map(([, name]) => name)
      .sort()
    const createdTriggers = [...companies.matchAll(/CREATE TRIGGER ([a-z_]+)/g)]
      .map(([, name]) => name)
      .sort()
    const droppedTriggers = [...companies.matchAll(/DROP TRIGGER IF EXISTS ([a-z_]+)/g)]
      .map(([, name]) => name)
      .sort()

    expect(droppedPolicies).toEqual(createdPolicies)
    expect(droppedTriggers).toEqual(createdTriggers)
  })

  it('stores model selection without coupling legacy rows to the current catalogue', () => {
    const conversations = readMigration('032_conversation_model_selection.sql')

    expect(conversations).toContain('ADD COLUMN IF NOT EXISTS selected_model TEXT')
    expect(conversations).toContain('selected_model IS NULL')
    expect(conversations).not.toContain('gpt-')
  })
})
