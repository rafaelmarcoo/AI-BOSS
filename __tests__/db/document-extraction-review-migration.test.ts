import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const migration = readFileSync(
  join(
    process.cwd(),
    'db/migrations/015_document_extraction_review.sql'
  ),
  'utf8'
)

describe('document extraction review migration', () => {
  it('separates document processing from financial review and adds XLSX', () => {
    expect(migration).toContain("CHECK (file_type IN ('pdf', 'csv', 'xlsx'))")
    expect(migration).toContain('financial_review_status TEXT NOT NULL')
    expect(migration).toContain(
      "CHECK (financial_review_status IN ('legacy', 'not_required', 'pending', 'confirmed'))"
    )
  })

  it('creates owner-bound extraction runs and candidates with RLS', () => {
    expect(migration).toContain(
      'CREATE TABLE IF NOT EXISTS public.document_extraction_runs'
    )
    expect(migration).toContain(
      'CREATE TABLE IF NOT EXISTS public.document_extraction_candidates'
    )
    expect(migration).toContain(
      'FOREIGN KEY (extraction_run_id, document_id, user_id)'
    )
    expect(migration).toContain(
      'ALTER TABLE public.document_extraction_runs ENABLE ROW LEVEL SECURITY'
    )
    expect(migration).toContain(
      'ALTER TABLE public.document_extraction_candidates ENABLE ROW LEVEL SECURITY'
    )
    expect(migration).toContain('USING (auth.uid() = user_id)')
  })

  it('keeps extraction evidence immutable to browser clients', () => {
    expect(migration).toContain('original_payload JSONB NOT NULL')
    expect(migration).toContain('reviewed_payload JSONB')
    expect(migration).not.toContain(
      'Users can update own document extraction candidates'
    )
    expect(migration).not.toContain(
      'Users can insert own document extraction candidates'
    )
  })

  it('publishes only complete owner-reviewed candidates transactionally', () => {
    expect(migration).toContain(
      'CREATE OR REPLACE FUNCTION public.confirm_document_extraction'
    )
    expect(migration).toContain('SECURITY DEFINER')
    expect(migration).toContain(
      "Every candidate must be reviewed exactly once."
    )
    expect(migration).toContain(
      "AND candidate.decision = 'included'"
    )
    expect(migration).toContain("'trustLabel', 'User-confirmed'")
    expect(migration).toContain(
      'REVOKE EXECUTE ON FUNCTION public.confirm_document_extraction(UUID, UUID, UUID, UUID, JSONB) FROM PUBLIC'
    )
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.confirm_document_extraction(UUID, UUID, UUID, UUID, JSONB) TO service_role'
    )
  })

  it('replaces observations only inside confirmation and only for one owner document', () => {
    const confirmationFunction = migration.slice(
      migration.indexOf(
        'CREATE OR REPLACE FUNCTION public.confirm_document_extraction'
      )
    )

    expect(confirmationFunction).toContain(
      'DELETE FROM public.financial_metric_observations'
    )
    expect(confirmationFunction).toContain('WHERE document_id = p_document_id')
    expect(confirmationFunction).toContain('AND user_id = p_user_id')
    expect(confirmationFunction).toContain(
      'INSERT INTO public.financial_metric_observations'
    )
  })
})
