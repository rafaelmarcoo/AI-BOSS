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
    throw new ApiError(400, 'BAD_REQUEST', 'The uploaded file is empty.')
  }
  if (value.size > MAX_STATEMENT_UPLOAD_BYTES) {
    throw new ApiError(400, 'BAD_REQUEST', 'The uploaded file is larger than 1 MB. A statement template should be a few kilobytes.')
  }
  const extension = value.name.split('.').pop()?.toLowerCase() ?? ''
  if (extension !== 'csv') {
    throw new ApiError(400, 'BAD_REQUEST', 'Upload the statements as a CSV file using the template.')
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
    throw new ApiError(400, 'VALIDATION_ERROR', 'The file has problems that need fixing before it can be saved.', {
      errors: review.errors,
    })
  }
  if (review.failedChecks.length > 0 && !confirmedChecks) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Some figures do not add up. Check them, then confirm to save anyway.', {
      failedChecks: review.failedChecks.map((check) => ({
        fiscalYearEnd: check.fiscalYearEnd,
        message: check.message,
      })),
    })
  }
}
