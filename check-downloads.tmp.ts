// Temporary: runs every statement CSV in Downloads through the app's own upload checks. Read-only.
import { readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parseStatementCsv } from '@/lib/company-analysis/statement-csv'
import { checkStatements } from '@/lib/company-analysis/statement-checks'

const folder = join(homedir(), 'Downloads')
for (const name of readdirSync(folder).filter((file) => file.endsWith('.csv')).sort()) {
  const bytes = readFileSync(join(folder, name))
  if (!bytes.toString('utf8').startsWith('Line,')) continue
  const result = parseStatementCsv(new Uint8Array(bytes))
  const failed = result.errors.length > 0
    ? []
    : checkStatements(result.years).flatMap((year) => year.checks.filter((check) => !check.passed).map((check) => `${year.fiscalYearEnd}: ${check.message}`))
  console.log(`\n${name}`)
  console.log(`  years: ${result.years.map((year) => year.fiscalYearEnd).join(', ') || '-'}; streams: ${result.years[0]?.streams.length ?? 0}`)
  if (result.errors.length) console.log(`  RED: ${result.errors.join(' | ')}`)
  if (failed.length) console.log(`  ORANGE: ${failed.join(' | ')}`)
  if (result.unrecognised.length) console.log(`  BLUE: ${result.unrecognised.map((row) => `row ${row.rowNumber} ${row.label}`).join(', ')}`)
  if (!result.errors.length && !failed.length && !result.unrecognised.length) console.log('  GREEN: all checks pass')
}
