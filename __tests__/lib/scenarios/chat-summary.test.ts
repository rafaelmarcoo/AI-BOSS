import { calculateScenarioAnalysis, type ScenarioBaselineInputs } from '@/lib/scenarios/calculation'
import { formatScenarioAnalysisForChat } from '@/lib/scenarios/chat-summary'
import type { ScenarioAnalysisInput } from '@/lib/scenarios/schema'

function metric(value: number) {
  return {
    value,
    sourceLabel: 'statement.csv',
    reportingDate: '2026-05-31',
    confidence: 0.95,
    origin: 'verified' as const,
    observationId: `metric-${value}`,
  }
}

describe('formatScenarioAnalysisForChat', () => {
  it('uses the deterministic result for both panels and never invents depreciation', () => {
    const baselineInputs: ScenarioBaselineInputs = {
      sourceKey: 'document:statement-1',
      sourceLabel: 'statement.csv',
      currency: 'NZD',
      cash: metric(80000),
      accountsReceivable: metric(16000),
      accountsPayable: metric(14000),
      burnRate: metric(17000),
      monthlyRevenue: metric(46000),
      monthlyExpenses: metric(37000),
      historicalMonthlyCashSlope: -10000,
      historicalObservationCount: 3,
      historicalSourceLabels: ['statement.csv'],
      historicalHasRecordedDateFallback: false,
      observationFingerprint: [{ id: 'cash-1', updatedAt: '2026-05-31T00:00:00Z' }],
    }
    const input: ScenarioAnalysisInput = {
      sourceKey: baselineInputs.sourceKey,
      currency: 'NZD',
      horizon: 6,
      trendRange: '6m',
      manualBaseline: {},
      scenarios: [
        {
          id: 'hire',
          label: 'Hire salesperson',
          adjustments: [{
            id: 'employer-cost', label: 'Total monthly employer cost', kind: 'fixed',
            flow: 'outflow', frequency: 'recurring', amount: 8000, startMonth: '2026-10',
          }],
        },
        {
          id: 'equipment',
          label: 'Buy equipment',
          adjustments: [{
            id: 'purchase', label: 'Equipment purchase', kind: 'fixed',
            flow: 'outflow', frequency: 'one_off', amount: 50000, startMonth: '2026-11',
          }],
        },
      ],
    }

    const result = calculateScenarioAnalysis({
      input,
      baselineInputs,
      now: '2026-06-01T00:00:00Z',
    })
    const summary = formatScenarioAnalysisForChat(result)

    expect(summary).toContain('Opening available liquidity:** NZD 82,000')
    expect(summary).toContain('### Current run rate')
    expect(summary).toContain('### Historical trend')
    expect(summary).toContain('**Hire salesperson**')
    expect(summary).toContain('**Buy equipment**')
    expect(summary).toContain('Recurring outflow: NZD 8,000 from 2026-10')
    expect(summary).toContain('One-off outflow: NZD 50,000 from 2026-11')
    expect(summary).not.toMatch(/depreciation/i)
  })
})
