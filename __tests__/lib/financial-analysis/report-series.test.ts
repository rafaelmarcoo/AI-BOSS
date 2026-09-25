import { buildAnalysisReportMetricSeries } from '@/lib/financial-analysis/report-series'
import type {
  FinancialForecastFact,
  FinancialTrendFact,
} from '@/lib/financial-analysis/types'

const history: FinancialTrendFact = {
  metricKey: 'cash',
  direction: 'worsening',
  observationCount: 3,
  firstValue: 100000,
  latestValue: 80000,
  absoluteChange: -20000,
  percentageChange: -20,
  values: [
    { date: '2026-03-31', value: 100000 },
    { date: '2026-04-30', value: 90000 },
    { date: '2026-05-31', value: 80000 },
  ],
}

const forecast: FinancialForecastFact = {
  metricKey: 'cash',
  method: 'date_aware_linear_trend',
  monthlySlope: -10000,
  values: [
    { month: '2026-06', value: 70000 },
    { month: '2026-07', value: 60000 },
    { month: '2026-08', value: 50000 },
    { month: '2026-09', value: 40000 },
    { month: '2026-10', value: 30000 },
    { month: '2026-11', value: 20000 },
  ],
}

describe('financial analysis report series', () => {
  it('keeps every recorded and forecast value in the exact-value table', () => {
    const series = buildAnalysisReportMetricSeries({ history, forecast })

    expect(series.tableRows).toHaveLength(9)
    expect(series.tableRows[0]).toEqual({
      period: '2026-03-31',
      phase: 'Actual',
      value: 100000,
    })
    expect(series.tableRows.at(-1)).toEqual({
      period: '2026-11-01',
      phase: 'Forecast',
      value: 20000,
    })
  })

  it('anchors the forecast line to the latest actual without duplicating the table row', () => {
    const series = buildAnalysisReportMetricSeries({ history, forecast })

    expect(series.chartPoints[2]).toEqual({
      period: '2026-05-31',
      actual: 80000,
      forecast: 80000,
    })
    expect(series.chartPoints[3]).toEqual({
      period: '2026-06-01',
      actual: null,
      forecast: 70000,
    })
    expect(series.forecastStartPeriod).toBe('2026-06-01')
  })

  it('supports limited reports without history or forecast data', () => {
    expect(buildAnalysisReportMetricSeries({ history: null, forecast: null })).toEqual({
      chartPoints: [],
      tableRows: [],
      forecastStartPeriod: null,
    })
  })
})
