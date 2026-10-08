import { ApiError } from '@/lib/api/errors'
import { checkStatements, type StatementCheck } from '@/lib/company-analysis/statement-checks'
import { parseStatementCsv } from '@/lib/company-analysis/statement-csv'
import type { StatementYear } from '@/lib/company-analysis/statement-analysis'

export const MAX_STATEMENT_UPLOAD_BYTES = 1024 * 1024

export function readStatementFile(value: FormDataEntryValue | null): File {
  if (!(value instanceof File)) {
    throw new ApiError(400, 'BAD_REQUEST', 'Choose a CSV file to upload.')
  }
  if (value.size === 0) {
    throw new ApiError(400, 'BAD_REQUEST', 'The file is empty.')
  }
  if (value.size > MAX_STATEMENT_UPLOAD_BYTES) {
    throw new ApiError(400, 'BAD_REQUEST', 'The file is too big (over 1 MB). A filled-in template is much smaller, so check you picked the right file.')
  }
  const extension = value.name.split('.').pop()?.toLowerCase() ?? ''
  if (extension !== 'csv') {
    throw new ApiError(400, 'BAD_REQUEST', 'Only CSV files work here. Use the template.')
  }
  return value
}

export interface FailedCheck extends StatementCheck {
  fiscalYearEnd: string
}

export interface StatementUploadReview {
  years: StatementYear[]
  unrecognised: Array<{ rowNumber: number; label: string }>
  errors: string[]
  failedChecks: FailedCheck[]
  checksRun: number
}

export async function reviewStatementUpload(file: File): Promise<StatementUploadReview> {
  const parsed = parseStatementCsv(new Uint8Array(await file.arrayBuffer()))
  const checks = parsed.errors.length > 0 ? [] : checkStatements(parsed.years)

  return {
    years: parsed.years,
    unrecognised: parsed.unrecognised,
    errors: parsed.errors,
    failedChecks: checks.flatMap(({ fiscalYearEnd, checks: yearChecks }) =>
      yearChecks.filter((check) => !check.passed).map((check) => ({ ...check, fiscalYearEnd }))
    ),
    checksRun: checks.reduce((total, year) => total + year.checks.length, 0),
  }
}

export function assertReadyToSave(review: StatementUploadReview, confirmedChecks: boolean) {
  if (review.errors.length > 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Fix the problems in the file before saving.', {
      errors: review.errors,
    })
  }
  if (review.failedChecks.length > 0 && !confirmedChecks) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Some figures don\'t add up. Tick the box to save anyway.', {
      failedChecks: review.failedChecks.map((check) => ({
        fiscalYearEnd: check.fiscalYearEnd,
        message: check.message,
      })),
    })
  }
}
