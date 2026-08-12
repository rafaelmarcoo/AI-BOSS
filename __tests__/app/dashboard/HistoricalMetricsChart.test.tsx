import { render, screen, waitFor } from '@testing-library/react'
import { HistoricalMetricsChart } from '@/app/dashboard/BurnRateChart'

jest.mock('recharts', () => ({
  CartesianGrid: () => null,
  Line: () => null,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}))

const history = {
  metricKey: 'cash',
  label: 'Cash',
  range: '3m',
  points: [
    { date: '2026-05-01', dateSource: 'as_of_date', value: 100, currency: 'NZD', sourceLabel: 'May CSV', sourceType: 'document', confidence: 0.9, updatedAt: '2026-05-01T00:00:00.000Z' },
    { date: '2026-06-01', dateSource: 'as_of_date', value: 120, currency: 'NZD', sourceLabel: 'June CSV', sourceType: 'document', confidence: 0.9, updatedAt: '2026-06-01T00:00:00.000Z' },
  ],
  movement: 'increased',
  direction: 'improving',
  firstValue: 100,
  latestValue: 120,
  totalChange: 20,
  percentageChange: 20,
  averageChange: 20,
  currency: 'NZD',
  sourceLabels: ['May CSV', 'June CSV'],
  hasMixedSources: true,
  hasRecordedDateFallback: false,
  hasIncompatibleCurrencies: false,
}

describe('HistoricalMetricsChart', () => {
  it('renders deterministic history and a mixed-source warning', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: history }),
    })

    render(<HistoricalMetricsChart refreshKey="initial" />)

    expect(screen.getByText('Historical financial trend')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Trend: improving')).toBeInTheDocument())
    expect(screen.getByText(/This trend combines sources: May CSV, June CSV/)).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/financial-data/history?metricKey=cash&range=3m',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('shows a safe empty state when fewer than two observations exist', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { ...history, points: [history.points[0]], direction: 'insufficient_data' },
      }),
    })

    render(<HistoricalMetricsChart refreshKey="empty" />)

    await waitFor(() => expect(screen.getByText(/Upload at least two dated records/)).toBeInTheDocument())
  })
})
