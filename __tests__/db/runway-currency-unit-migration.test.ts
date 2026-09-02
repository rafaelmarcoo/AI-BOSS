import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const migration = readFileSync(
  join(process.cwd(), 'db/migrations/016_runway_currency_unit.sql'),
  'utf8'
)

describe('runway currency unit migration', () => {
  it('rejects currency for runway and requires supported currency for money', () => {
    expect(migration).toContain("review.metric_key = 'runway_months'")
    expect(migration).toContain('AND review.currency IS NOT NULL')
    expect(migration).toContain("review.metric_key <> 'runway_months'")
    expect(migration).toContain(
      "UPPER(review.currency) NOT IN ('NZD', 'AUD')"
    )
  })

  it('publishes a null canonical currency for runway', () => {
    expect(migration).toContain(
      "WHEN review.metric_key = 'runway_months' THEN NULL"
    )
    expect(migration).toContain(
      'INSERT INTO public.financial_metric_observations'
    )
  })

  it('retains the service-role-only confirmation boundary', () => {
    expect(migration).toContain('SECURITY DEFINER')
    expect(migration).toContain(
      'REVOKE EXECUTE ON FUNCTION public.confirm_document_extraction(UUID, UUID, UUID, UUID, JSONB) FROM PUBLIC'
    )
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.confirm_document_extraction(UUID, UUID, UUID, UUID, JSONB) TO service_role'
    )
  })
})
