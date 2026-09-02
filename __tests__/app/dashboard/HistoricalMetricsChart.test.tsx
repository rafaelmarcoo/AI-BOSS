import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { HistoricalMetricsChart } from '@/app/dashboard/BurnRateChart'

jest.mock('recharts', () => ({
  CartesianGrid: () => null,
  Legend: () => null,
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
  excludedCurrencyObservationCount: 0,
  hasMissingCurrencyObservations: false,
  unsupportedCurrencies: [],
}

const historyCollection = {
  metricKey: 'cash',
  label: 'Cash',
  range: '3m',
  recordLimit: 12,
  selectedCurrency: null,
  selectedSourceKey: null,
  availableCurrencies: ['NZD'],
  availableSources: [
    { key: 'document:may', label: 'May CSV', sourceId: 'may', sourceType: 'document' },
    { key: 'document:june', label: 'June CSV', sourceId: 'june', sourceType: 'document' },
  ],
  series: [history],
  excludedCurrencyObservationCount: 0,
  hasMissingCurrencyObservations: false,
  unsupportedCurrencies: [],
}

describe('HistoricalMetricsChart', () => {
  it('renders deterministic history and a mixed-source warning', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: historyCollection }),
    })

    render(<HistoricalMetricsChart refreshKey="initial" />)

    expect(screen.getByText('Financial trend and forecast')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Trend: improving')).toBeInTheDocument())
    expect(screen.getByText('Currency: NZD')).toBeInTheDocument()
    expect(screen.getByText(/Reporting period:/)).toBeInTheDocument()
    expect(screen.getByText('Latest recorded value')).toBeInTheDocument()
    expect(screen.getByText(/NZD 120 as at/)).toBeInTheDocument()
    expect(screen.getByText(/This trend combines sources: May CSV, June CSV/)).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/financial-data/history?metricKey=cash&range=3m&currency=all&recordLimit=12',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('loads a deterministic forecast when forecast mode and a horizon are selected', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          data: url.includes('/forecast')
            ? { ...historyCollection, horizon: 6, series: [{
                metricKey: 'cash', label: 'Cash', range: '3m', horizon: 6,
                history,
                forecastPoints: [{ date: '2026-07-01', value: 140, kind: 'forecast' }],
                latestActualValue: 120,
                monthlySlope: 20,
                method: 'date_aware_linear_trend',
                assumptions: ['Projects the observed date-aware linear trend from the latest actual value.'],
              }] }
            : historyCollection,
        }),
      })
    )

    render(<HistoricalMetricsChart refreshKey="forecast" />)
    await waitFor(() => expect(screen.getByText('Trend: improving')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Forecast' }))
    const horizonControls = await screen.findByRole('group', { name: 'Forecast period' })
    fireEvent.click(within(horizonControls).getByRole('button', { name: 'Next 6 months' }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      '/api/financial-data/forecast?metricKey=cash&range=3m&currency=all&recordLimit=12&horizon=6',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ))
    expect(screen.getByText('Projected monthly change')).toBeInTheDocument()
    expect(screen.getByText('+NZD 20')).toBeInTheDocument()
  })

  it('shows a safe empty state when fewer than two observations exist', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          ...historyCollection,
          series: [{ ...history, points: [history.points[0]], direction: 'insufficient_data' }],
        },
      }),
    })

    render(<HistoricalMetricsChart refreshKey="empty" />)

    await waitFor(() => expect(screen.getByText(/needs at least two compatible dated records/)).toBeInTheDocument())
  })

  it('lets users view both runway plots or either derived variant', async () => {
    const cashRunway = {
      ...history,
      metricKey: 'runway_months',
      runwayVariant: 'cash',
      seriesKey: 'document:statement-1',
      label: 'Cash runway',
      currency: 'NZD',
      latestValue: 6.47,
      points: history.points.map((point, index) => ({ ...point, value: 6 + index * 0.47 })),
    }
    const adjustedRunway = {
      ...cashRunway,
      runwayVariant: 'working_capital_adjusted',
      label: 'Working-capital-adjusted runway',
      latestValue: 6.59,
      points: history.points.map((point, index) => ({ ...point, value: 6.1 + index * 0.49 })),
    }
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          ...historyCollection,
          metricKey: 'runway_months',
          label: 'Runway',
          series: [cashRunway, adjustedRunway],
        },
      }),
    })

    render(<HistoricalMetricsChart refreshKey="runway" />)
    fireEvent.mouseDown(screen.getByLabelText('Financial metric'))
    fireEvent.click(await screen.findByRole('option', { name: 'Runway' }))

    const controls = await screen.findByRole('group', { name: 'Runway plots' })
    expect(within(controls).getByRole('button', { name: 'Both' })).toBeInTheDocument()
    expect(screen.getByText('Latest cash runway')).toBeInTheDocument()
    expect(screen.getByText('Latest working-capital-adjusted runway')).toBeInTheDocument()

    fireEvent.click(within(controls).getByRole('button', { name: 'Cash runway' }))
    expect(screen.getByText('Latest cash runway')).toBeInTheDocument()
    expect(screen.queryByText('Latest working-capital-adjusted runway')).not.toBeInTheDocument()
  })
})
