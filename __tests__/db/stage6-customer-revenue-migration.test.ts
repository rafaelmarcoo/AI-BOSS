import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const migration = readFileSync(
  join(process.cwd(), 'db/migrations/023_stage6_customer_and_revenue_dimensions.sql'),
  'utf8',
)

describe('Stage 6 customer revenue migration', () => {
  it('creates normalized customers, revenue entries, dimensions, and links', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.financial_customers')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.financial_revenue_entries')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.financial_revenue_dimensions')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.financial_revenue_entry_dimensions')
  })

  it('keeps currency and source provenance on each revenue entry', () => {
    expect(migration).toContain("CHECK (currency ~ '^[A-Z]{3}$')")
    expect(migration).toContain('provider_revenue_id TEXT NOT NULL')
    expect(migration).toContain('UNIQUE (user_id, source_type, provider_revenue_id)')
  })

  it('enforces one correctly typed dimension per entry axis', () => {
    expect(migration).toContain('UNIQUE (revenue_entry_id, dimension_type, dimension_group)')
    expect(migration).toContain('FOREIGN KEY (dimension_id, dimension_type, dimension_group)')
    expect(migration).toContain('REFERENCES public.financial_revenue_dimensions(id, dimension_type, dimension_group)')
  })

  it('enables RLS for every new table', () => {
    for (const table of [
      'financial_customers',
      'financial_revenue_dimensions',
      'financial_revenue_entries',
      'financial_revenue_entry_dimensions',
    ]) {
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`)
    }
    expect(migration).toContain('USING (auth.uid() = user_id)')
  })
})
