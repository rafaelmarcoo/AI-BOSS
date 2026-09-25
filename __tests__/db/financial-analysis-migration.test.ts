import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const migration = readFileSync(
  join(process.cwd(), 'db/migrations/020_financial_analysis_runs.sql'),
  'utf8'
)
const timelineMigration = readFileSync(
  join(process.cwd(), 'db/migrations/021_financial_analysis_timeline.sql'),
  'utf8'
)

describe('financial analysis migration', () => {
  it('creates versioned immutable report snapshots and append-only decision tests', () => {
    expect(migration).toContain(
      'CREATE TABLE IF NOT EXISTS public.financial_analysis_runs'
    )
    expect(migration).toContain(
      'CREATE TABLE IF NOT EXISTS public.financial_decision_tests'
    )
    expect(migration).toContain("result_payload ? 'version'")
    expect(migration).toContain('baseline_fingerprint JSONB NOT NULL')
    expect(migration).toContain('agent_trace JSONB NOT NULL')
    expect(migration).toContain('model_metadata JSONB NOT NULL')
    expect(migration).toContain('token_metadata JSONB NOT NULL')
  })

  it('enforces supported statuses, readiness, currencies, and outcomes', () => {
    expect(migration).toContain(
      "CHECK (run_status IN ('complete', 'completed_with_fallback'))"
    )
    expect(migration).toContain(
      "CHECK (data_readiness IN ('ready', 'limited', 'action_required'))"
    )
    expect(migration).toContain("CHECK (selected_currency IN ('NZD', 'AUD'))")
    expect(migration).toContain(
      "CHECK (outcome IN ('allowed', 'blocked', 'overridden'))"
    )
  })

  it('binds each decision test to a report owned by the same user', () => {
    expect(migration).toContain('UNIQUE (id, user_id)')
    expect(migration).toContain(
      'FOREIGN KEY (analysis_run_id, user_id)'
    )
    expect(migration).toContain(
      'REFERENCES public.financial_analysis_runs(id, user_id)'
    )
  })

  it('requires a 10-to-500 character reason if and only if overridden', () => {
    expect(migration).toContain("outcome = 'overridden'")
    expect(migration).toContain(
      'CHAR_LENGTH(BTRIM(override_reason)) BETWEEN 10 AND 500'
    )
    expect(migration).toContain("outcome <> 'overridden'")
    expect(migration).toContain('override_reason IS NULL')
  })

  it('allows owners to select and insert but exposes no update or delete policy', () => {
    expect(migration).toContain(
      'ALTER TABLE public.financial_analysis_runs ENABLE ROW LEVEL SECURITY'
    )
    expect(migration).toContain(
      'ALTER TABLE public.financial_decision_tests ENABLE ROW LEVEL SECURITY'
    )
    expect(migration.match(/FOR SELECT/g)).toHaveLength(2)
    expect(migration.match(/FOR INSERT/g)).toHaveLength(2)
    expect(migration).not.toContain('FOR UPDATE')
    expect(migration).not.toContain('FOR DELETE')
    expect(migration).toContain(
      'REVOKE UPDATE, DELETE ON TABLE public.financial_analysis_runs FROM authenticated'
    )
    expect(migration).toContain(
      'REVOKE UPDATE, DELETE ON TABLE public.financial_decision_tests FROM authenticated'
    )
  })

  it('adds and backfills constrained timeline selection metadata', () => {
    expect(timelineMigration).toContain('ADD COLUMN selection_mode TEXT')
    expect(timelineMigration).toContain('ADD COLUMN selected_sources JSONB')
    expect(timelineMigration).toContain('ADD COLUMN reporting_period_start DATE')
    expect(timelineMigration).toContain('ADD COLUMN reporting_period_end DATE')
    expect(timelineMigration).toContain("selection_mode = 'single'")
    expect(timelineMigration).toContain(
      "CHECK (selection_mode IN ('single', 'timeline'))"
    )
    expect(timelineMigration).toContain(
      "selection_mode = 'timeline' AND JSONB_ARRAY_LENGTH(selected_sources) BETWEEN 2 AND 12"
    )
    expect(timelineMigration).toContain(
      'CHECK (reporting_period_start <= reporting_period_end)'
    )
  })
})
