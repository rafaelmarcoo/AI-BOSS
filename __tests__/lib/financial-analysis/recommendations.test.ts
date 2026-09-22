import { ZodError } from 'zod'
import { selectFinancialRecommendations } from '@/lib/financial-analysis/recommendations'

describe('deterministic financial recommendations', () => {
  it('uses the approved priority and caps output at three', () => {
    const recommendations = selectFinancialRecommendations({
      readinessStatus: 'limited',
      missingMetricKeys: ['accounts_receivable'],
      runwayStatus: 'urgent',
      operatingBalance: -10000,
      cashTrend: 'worsening',
      burnTrend: 'worsening',
      workingCapitalPosition: 'net_payable',
    })

    expect(recommendations.map((recommendation) => recommendation.id)).toEqual([
      'fix_data_gaps',
      'protect_runway_now',
      'restore_operating_balance',
    ])
    expect(recommendations.map((recommendation) => recommendation.priority)).toEqual([1, 2, 3])
  })

  it('selects trend, timing, and caution-buffer recommendations in order', () => {
    const recommendations = selectFinancialRecommendations({
      readinessStatus: 'ready',
      missingMetricKeys: [],
      runwayStatus: 'caution',
      operatingBalance: 5000,
      cashTrend: 'worsening',
      burnTrend: 'stable',
      workingCapitalPosition: 'net_receivable',
    })

    expect(recommendations.map((recommendation) => recommendation.id)).toEqual([
      'address_worsening_cash_or_burn',
      'improve_collections_and_payable_timing',
      'build_runway_buffer',
    ])
  })

  it('returns no recommendation when no deterministic trigger is present', () => {
    expect(selectFinancialRecommendations({
      readinessStatus: 'ready',
      missingMetricKeys: [],
      runwayStatus: 'healthy',
      operatingBalance: 1,
      cashTrend: 'improving',
      burnTrend: 'improving',
      workingCapitalPosition: 'balanced',
    })).toEqual([])
  })

  it('rejects invalid recommendation inputs', () => {
    expect(() => selectFinancialRecommendations({
      readinessStatus: 'ready',
      missingMetricKeys: [],
      runwayStatus: 'healthy',
      operatingBalance: Number.POSITIVE_INFINITY,
      cashTrend: 'improving',
      burnTrend: 'improving',
      workingCapitalPosition: 'balanced',
    })).toThrow(ZodError)
  })
})
