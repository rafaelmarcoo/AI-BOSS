import { readRunwayObservationHistory } from '@/lib/financial-data/runway-history'
import { createForecastRunwayTrendTool } from '@/lib/tools/financial/forecast-runway-trend'
import { createGetRunwayHistoryTool } from '@/lib/tools/financial/get-runway-history'
import type { AvailableFinancialMetricValue } from '@/lib/financial-data/types'

jest.mock('@/lib/financial-data/runway-history', () => {
  const actual = jest.requireActual('@/lib/financial-data/runway-history')

  return {
    ...actual,
    readRunwayObservationHistory: jest.fn(),
  }
})

const mockReadRunwayObservationHistory = jest.mocked(readRunwayObservationHistory)

function runway(value: number, asOfDate: string): AvailableFinancialMetricValue {
  return {
    status: 'available',
    key: 'runway_months',
    value,
    currency: null,
    periodStart: null,
    periodEnd: null,
    asOfDate,
    provenance: {
      sourceType: 'document',
      sourceLabel: 'demo.csv',
    },
    confidence: 0.9,
    updatedAt: `${asOfDate}T00:00:00.000Z`,
  }
}

describe('runway trend tools', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('get_runway_history handles no observations', async () => {
    mockReadRunwayObservationHistory.mockResolvedValue({
      observations: [],
      direction: 'insufficient_data',
      change: null,
      averageChange: null,
    })

    await expect(
      createGetRunwayHistoryTool('user-123').handler({})
    ).resolves.toContain('No runway history is available yet')
  })

  it('get_runway_history explains one observation is not enough for trend', async () => {
    mockReadRunwayObservationHistory.mockResolvedValue({
      observations: [runway(5.4, '2026-05-12')],
      direction: 'insufficient_data',
      change: null,
      averageChange: null,
    })

    await expect(
      createGetRunwayHistoryTool('user-123').handler({})
    ).resolves.toContain('At least 2 runway observations')
  })

  it('get_runway_history describes an improving trend', async () => {
    mockReadRunwayObservationHistory.mockResolvedValue({
      observations: [runway(4.2, '2026-05-12'), runway(5.4, '2026-06-12')],
      direction: 'improving',
      change: 1.2,
      averageChange: 1.2,
    })

    await expect(
      createGetRunwayHistoryTool('user-123').handler({})
    ).resolves.toContain('runway is improving')
  })

  it('get_runway_history describes a declining trend', async () => {
    mockReadRunwayObservationHistory.mockResolvedValue({
      observations: [runway(5.4, '2026-05-12'), runway(3.4, '2026-06-12')],
      direction: 'declining',
      change: -2,
      averageChange: -2,
    })

    await expect(
      createGetRunwayHistoryTool('user-123').handler({})
    ).resolves.toContain('runway is declining')
  })

  it('forecast_runway_trend handles insufficient history', async () => {
    mockReadRunwayObservationHistory.mockResolvedValue({
      observations: [runway(5.4, '2026-05-12')],
      direction: 'insufficient_data',
      change: null,
      averageChange: null,
    })

    await expect(
      createForecastRunwayTrendTool('user-123').handler({})
    ).resolves.toContain('Not enough runway history')
  })

  it('forecast_runway_trend handles improving trends', async () => {
    mockReadRunwayObservationHistory.mockResolvedValue({
      observations: [runway(4.2, '2026-05-12'), runway(5.4, '2026-06-12')],
      direction: 'improving',
      change: 1.2,
      averageChange: 1.2,
    })

    await expect(
      createForecastRunwayTrendTool('user-123').handler({})
    ).resolves.toContain('not moving toward the caution or urgent thresholds')
  })

  it('forecast_runway_trend estimates threshold timing for declining trends', async () => {
    mockReadRunwayObservationHistory.mockResolvedValue({
      observations: [runway(5.4, '2026-05-12'), runway(4.4, '2026-06-12')],
      direction: 'declining',
      change: -1,
      averageChange: -1,
    })

    const result = await createForecastRunwayTrendTool('user-123').handler({})

    expect(result).toContain('Caution threshold')
    expect(result).toContain('Urgent threshold')
    expect(result).toContain('rough continuation estimate')
  })
})
