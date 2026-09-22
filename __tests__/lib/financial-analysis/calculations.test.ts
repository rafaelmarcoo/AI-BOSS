import { ZodError } from 'zod'
import {
  calculateAnalysisRunway,
  calculateOperatingBalance,
  calculateReceivablesPayablesPosition,
  classifyFinancialAnalysisReadiness,
} from '@/lib/financial-analysis/calculations'
import { FINANCIAL_METRIC_KEYS } from '@/lib/financial-data/metric-keys'

describe('financial analysis calculations', () => {
  it('calculates operating balance without presenting it as profit', () => {
    expect(calculateOperatingBalance({
      monthlyRevenue: 60000,
      monthlyExpenses: 75000,
    })).toEqual({
      monthlyRevenue: 60000,
      monthlyExpenses: 75000,
      operatingBalance: -15000,
      position: 'negative',
      formula: '60000 - 75000 = -15000',
    })
  })

  it.each([
    [20000, 10000, 10000, 'net_receivable'],
    [10000, 20000, -10000, 'net_payable'],
    [10000, 10000, 0, 'balanced'],
  ] as const)(
    'classifies receivables %p and payables %p',
    (accountsReceivable, accountsPayable, netPosition, position) => {
      expect(calculateReceivablesPayablesPosition({
        accountsReceivable,
        accountsPayable,
      })).toMatchObject({ netPosition, position })
    }
  )

  it('reuses the trusted cash and working-capital runway calculation', () => {
    const result = calculateAnalysisRunway({
      cash: 85000,
      accountsReceivable: 16000,
      accountsPayable: 14000,
      monthlyBurnRate: 17000,
    })

    expect(result.cashRunwayMonths).toBe(5)
    expect(result.workingCapitalAdjustedRunwayMonths).toBe(5.12)
    expect(result.cashRunwayFormula).toBe('85000 / 17000 = 5 months')
    expect(result.workingCapitalAdjustedRunwayFormula).toBe(
      '(85000 + 16000 - 14000) / 17000 = 5.12 months'
    )
  })

  it('keeps cash runway available when working-capital inputs are unavailable', () => {
    const result = calculateAnalysisRunway({
      cash: 80000,
      monthlyBurnRate: 20000,
    })

    expect(result.cashRunwayMonths).toBe(4)
    expect(result.workingCapitalAdjustedRunwayMonths).toBeNull()
    expect(result.workingCapitalAdjustedRunwayFormula).toBeNull()
  })

  it('classifies a complete selected baseline with history as ready', () => {
    const result = classifyFinancialAnalysisReadiness({
      availableMetricKeys: [...FINANCIAL_METRIC_KEYS],
      historicalObservationCount: 12,
      sourceSelectionRequired: true,
      sourceSelected: true,
      currencySelectionRequired: true,
      currencySelected: true,
    })

    expect(result.readiness.status).toBe('ready')
    expect(result.readiness.historicalObservationCount).toBe(12)
    expect(result.sections.every((section) => section.status === 'available')).toBe(true)
  })

  it('classifies a usable but incomplete baseline as limited', () => {
    const result = classifyFinancialAnalysisReadiness({
      availableMetricKeys: ['cash', 'burn_rate'],
      historicalObservationCount: 1,
      sourceSelectionRequired: false,
      sourceSelected: true,
      currencySelectionRequired: false,
      currencySelected: true,
    })

    expect(result.readiness.status).toBe('limited')
    expect(result.sections.find((section) => section.sectionId === 'current_runway')?.status).toBe('limited')
    expect(result.sections.find((section) => section.sectionId === 'forecast')?.status).toBe('unavailable')
  })

  it('requires action when a core metric or required explicit selection is missing', () => {
    const result = classifyFinancialAnalysisReadiness({
      availableMetricKeys: ['cash'],
      historicalObservationCount: 0,
      sourceSelectionRequired: true,
      sourceSelected: false,
      currencySelectionRequired: true,
      currencySelected: false,
    })

    expect(result.readiness.status).toBe('action_required')
    expect(result.readiness.reasons.join(' ')).toContain('Select one financial source')
    expect(result.readiness.reasons.join(' ')).toContain('burn rate')
  })

  it('rejects invalid amounts, duplicate metrics, and history over the 12-observation cap', () => {
    expect(() => calculateOperatingBalance({
      monthlyRevenue: -1,
      monthlyExpenses: 100,
    })).toThrow(ZodError)
    expect(() => calculateAnalysisRunway({
      cash: 100,
      accountsReceivable: 0,
      accountsPayable: 0,
      monthlyBurnRate: 0,
    })).toThrow(ZodError)
    expect(() => classifyFinancialAnalysisReadiness({
      availableMetricKeys: ['cash', 'cash'],
      historicalObservationCount: 13,
      sourceSelectionRequired: false,
      sourceSelected: true,
      currencySelectionRequired: false,
      currencySelected: true,
    })).toThrow(ZodError)
  })
})
