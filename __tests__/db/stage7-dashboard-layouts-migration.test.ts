/** @jest-environment node */

import fs from 'node:fs'
import path from 'node:path'

describe('Stage 7 dashboard layout migration', () => {
  const sql = fs.readFileSync(
    path.join(process.cwd(), 'db/migrations/024_stage7_dashboard_layouts.sql'),
    'utf8',
  )

  it('creates versioned user-owned layouts with one default and RLS', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.user_dashboard_layouts')
    expect(sql).toContain('layout_payload JSONB NOT NULL')
    expect(sql).toContain('idx_user_dashboard_layouts_one_default')
    expect(sql).toContain('WHERE is_default')
    expect(sql).toContain('clear_other_user_dashboard_layout_defaults')
    expect(sql).toContain('BEFORE INSERT OR UPDATE OF is_default')
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY')
    expect(sql).toContain('user_id = auth.uid()')
    expect(sql).toContain('FOR DELETE')
  })
})
