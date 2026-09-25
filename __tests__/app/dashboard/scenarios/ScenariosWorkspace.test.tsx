import { render, screen, waitFor } from '@testing-library/react'
import { ScenariosWorkspace } from '@/app/dashboard/scenarios/ScenariosWorkspace'

jest.mock('recharts', () => ({
  CartesianGrid: () => null,
  Legend: () => null,
  Line: () => null,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ReferenceLine: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}))

const frozenReport = {
  id: 'analysis-1',
  createdAt: '2026-07-01T00:00:00.000Z',
  result: {
    selectedBaseline: {
      currency: 'NZD',
      reportDate: '2026-06-30',
      sources: [{ sourceLabel: 'june.csv' }],
    },
    evidence: [{
      observationId: 'cash-1',
      metricKey: 'cash',
      value: 90000,
      reportingDate: '2026-06-30',
      sourceLabel: 'june.csv',
      confidence: 0.95,
      usedInCalculations: true,
      resolution: 'uncontested',
    }],
    facts: {
      history: [{ metricKey: 'cash', observationCount: 3 }],
      forecasts: [{ metricKey: 'cash', monthlySlope: -5000 }],
    },
  },
}

describe('Scenarios report handoff', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    window.sessionStorage.clear()
    window.sessionStorage.setItem(
      'ai-boss-scenario-draft',
      JSON.stringify({ analysisRunId: 'analysis-1' })
    )
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      configurable: true,
      value: jest.fn()
        .mockReturnValueOnce('scenario-id')
        .mockReturnValueOnce('adjustment-id'),
    })
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('loads the immutable report baseline and identifies missing manual assumptions', async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/scenarios/baselines') {
        return {
          ok: true,
          json: async () => ({ success: true, data: { baselines: [] } }),
        } as Response
      }
      if (url === '/api/scenarios') {
        return {
          ok: true,
          json: async () => ({ success: true, data: { scenarios: [] } }),
        } as Response
      }
      if (url === '/api/financial-analysis/analysis-1') {
        return {
          ok: true,
          json: async () => ({ success: true, data: { report: frozenReport } }),
        } as Response
      }
      throw new Error(`Unexpected request: ${url}`)
    })
    global.fetch = fetchMock as typeof fetch

    render(<ScenariosWorkspace />)

    expect(await screen.findByText(/immutable financial analysis report/)).toBeInTheDocument()
    expect(screen.getByText(
      /Missing from this baseline: Accounts receivable, Accounts payable, Monthly burn, Monthly revenue, Monthly expenses/
    )).toBeInTheDocument()
    expect(screen.getByRole('combobox', {
      name: 'Historical trend lookback',
    })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByDisplayValue('Decision test — 2026-06-30')).toBeInTheDocument()
    expect(window.sessionStorage.getItem('ai-boss-scenario-draft')).toBeNull()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/financial-analysis/analysis-1'
    ))
  })
})
