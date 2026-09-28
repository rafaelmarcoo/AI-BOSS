import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const companyReviewMigration = readFileSync(
  join(process.cwd(), 'db/migrations/022_company_financial_review.sql'),
  'utf8'
)
const imageMigration = readFileSync(
  join(process.cwd(), 'db/migrations/023_document_image_support.sql'),
  'utf8'
)

describe('company financial review migrations', () => {
  it('adds a company boundary to documents and trusted observations', () => {
    expect(companyReviewMigration).toContain(
      'ALTER TABLE public.documents\n  ADD COLUMN IF NOT EXISTS company_id'
    )
    expect(companyReviewMigration).toContain(
      'ALTER TABLE public.financial_metric_observations\n  ADD COLUMN IF NOT EXISTS company_id'
    )
    expect(companyReviewMigration).toContain(
      'idx_financial_metric_observations_company_metric_updated'
    )
  })

  it('keeps draft review separate from admin-only confirmation', () => {
    expect(companyReviewMigration).toContain(
      'CREATE OR REPLACE FUNCTION public.save_document_extraction_review_draft'
    )
    expect(companyReviewMigration).toContain(
      "review.decision NOT IN ('pending', 'included', 'excluded')"
    )
    expect(companyReviewMigration).toContain(
      "v_reviewer_role IS DISTINCT FROM 'admin'"
    )
    expect(companyReviewMigration).toContain(
      "Only an administrator from this company can confirm financial values."
    )
    expect(companyReviewMigration).toContain(
      'candidate.user_id, v_company_id, NULL, candidate.document_id'
    )
    expect(companyReviewMigration).toContain(
      'DROP POLICY IF EXISTS "Users can update own documents"'
    )
    expect(companyReviewMigration).toContain(
      'DROP POLICY IF EXISTS "Users can delete own documents"'
    )
    expect(companyReviewMigration).toContain(
      'DROP CONSTRAINT IF EXISTS document_extraction_candidates_reviewer_check'
    )
    expect(companyReviewMigration).toContain(
      "decision = 'pending'"
    )
    expect(companyReviewMigration).toContain(
      '(reviewer_id IS NOT NULL AND reviewed_at IS NOT NULL)'
    )
  })

  it('restricts company financial observations to company administrators', () => {
    expect(companyReviewMigration).toContain(
      'Company admins can view company financial metric observations'
    )
    expect(companyReviewMigration).toContain(
      "public.current_user_company_role() = 'admin'"
    )
  })

  it('adds the image file type without changing existing review states', () => {
    expect(imageMigration).toContain(
      "CHECK (file_type IN ('pdf', 'csv', 'xlsx', 'image'))"
    )
  })
})
