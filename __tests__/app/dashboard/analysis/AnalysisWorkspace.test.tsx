import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import {
  AnalysisWorkspace,
  ReportView,
} from '@/app/dashboard/analysis/AnalysisWorkspace'
import {
  FINANCIAL_ANALYSIS_COMPARISON_METRIC_KEYS,
  FINANCIAL_ANALYSIS_SECTION_IDS,
} from '@/lib/financial-analysis/types'
import type { FinancialAnalysisRunView } from '@/lib/financial-analysis/persistence'

jest.mock('recharts', () => ({
  CartesianGrid: () => null,
  Line: () => null,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ReferenceLine: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}))

const report: FinancialAnalysisRunView = {
  id: 'analysis-1',
  selectedSourceKey: 'document:statement-1',
  selectedSourceLabel: 'statement.csv',
  selectedCurrency: 'NZD',
  selectionMode: 'single',
  selectedSources: [{ sourceKey: 'document:statement-1', sourceLabel: 'statement.csv' }],
  reportingPeriodStart: '2026-01-31',
  reportingPeriodEnd: '2026-06-30',
  runStatus: 'complete',
  dataReadiness: 'ready',
  createdAt: '2026-07-01T00:00:00.000Z',
  result: {
    version: 'financial-analysis-v2',
    runStatus: 'complete',
    generatedAt: '2026-07-01T00:00:00.000Z',
    selectedBaseline: {
      mode: 'single',
      sourceKey: 'document:statement-1',
      sourceLabel: 'statement.csv',
      currency: 'NZD',
      sources: [{
        sourceKey: 'document:statement-1',
        sourceLabel: 'statement.csv',
        sourceType: 'document',
        documentId: 'statement-1',
        connectionId: null,
      }],
      reportingPeriodStart: '2026-01-31',
      reportingPeriodEnd: '2026-06-30',
      reportDate: '2026-06-30',
    },
    readiness: {
      status: 'ready',
      availableMetricKeys: ['cash', 'monthly_expenses', 'burn_rate', 'runway_months'],
      missingMetricKeys: [],
      historicalObservationCount: 2,
      reasons: [],
    },
    sections: FINANCIAL_ANALYSIS_SECTION_IDS.map((sectionId) => ({
      sectionId,
      status: 'available',
      reason: null,
    })),
    facts: {
      operatingBalance: null,
      receivablesPayables: null,
      runway: {
        cash: 85000,
        monthlyBurnRate: 17000,
        cashRunwayMonths: 5,
        cashRunwayFormula: '85000 / 17000 = 5 months',
        accountsReceivable: null,
        accountsPayable: null,
        workingCapitalAdjustedRunwayMonths: null,
        workingCapitalAdjustedRunwayFormula: null,
      },
      history: [{
        metricKey: 'cash',
        direction: 'worsening',
        observationCount: 2,
        firstValue: 103000,
        latestValue: 85000,
        absoluteChange: -18000,
        percentageChange: -17.48,
        values: [
          { date: '2026-01-31', value: 103000 },
          { date: '2026-06-30', value: 85000 },
        ],
      }],
      forecasts: [],
      periodComparisons: FINANCIAL_ANALYSIS_COMPARISON_METRIC_KEYS.map((metricKey) =>
        metricKey === 'cash'
          ? {
              metricKey,
              earliest: { reportingDate: '2026-01-31', value: 103000 },
              previous: { reportingDate: '2026-01-31', value: 103000 },
              latest: { reportingDate: '2026-06-30', value: 85000 },
              startToLatestChange: { absolute: -18000, percentage: -17.48 },
              previousToLatestChange: { absolute: -18000, percentage: -17.48 },
              unavailableReason: null,
            }
          : {
              metricKey,
              earliest: null,
              previous: null,
              latest: null,
              startToLatestChange: null,
              previousToLatestChange: null,
              unavailableReason: 'Comparison unavailable.',
            }
      ),
    },
    narrative: {
      executiveSummary: 'Cash runway needs attention.',
      financialPosition: 'Current cash remains positive.',
      trendAndForecast: 'Cash declined across the reporting period.',
      risks: ['Runway is below the healthy band.'],
      limitations: ['Forecast inputs are limited.'],
    },
    evidence: [
      {
        observationId: 'cash-old',
        metricKey: 'cash',
        value: 103000,
        currency: 'NZD',
        reportingDate: '2026-01-31',
        sourceLabel: 'statement.csv',
        sourceType: 'document',
        sourceKey: 'document:statement-1',
        documentId: 'statement-1',
        connectionId: null,
        confidence: 0.95,
        usedInCalculations: true,
        resolution: 'uncontested',
      },
      {
        observationId: 'cash-current',
        metricKey: 'cash',
        value: 85000,
        currency: 'NZD',
        reportingDate: '2026-06-30',
        sourceLabel: 'statement.csv',
        sourceType: 'document',
        sourceKey: 'document:statement-1',
        documentId: 'statement-1',
        connectionId: null,
        confidence: 0.95,
        usedInCalculations: true,
        resolution: 'uncontested',
      },
      {
        observationId: 'burn-current',
        metricKey: 'burn_rate',
        value: 17000,
        currency: 'NZD',
        reportingDate: '2026-06-30',
        sourceLabel: 'statement.csv',
        sourceType: 'document',
        sourceKey: 'document:statement-1',
        documentId: 'statement-1',
        connectionId: null,
        confidence: 0.95,
        usedInCalculations: true,
        resolution: 'uncontested',
      },
      {
        observationId: 'expenses-current',
        metricKey: 'monthly_expenses',
        value: 70000,
        currency: 'NZD',
        reportingDate: '2026-06-30',
        sourceLabel: 'statement.csv',
        sourceType: 'document',
        sourceKey: 'document:statement-1',
        documentId: 'statement-1',
        connectionId: null,
        confidence: 0.95,
        usedInCalculations: true,
        resolution: 'uncontested',
      },
    ],
    assumptions: ['No currency conversion was performed.'],
    agentTrace: { fallbackUsed: false, entries: [] },
    policy: {
      policyVersion: 'mvp-v1',
      decision: 'warn',
      triggeredRuleIds: ['current_runway_caution'],
      rules: [
        {
          ruleId: 'current_runway_urgent',
          status: 'passed',
          severity: 'warning',
          actual: 5,
          threshold: 3,
          message: 'Current cash runway is not in the urgent band.',
        },
        {
          ruleId: 'current_runway_caution',
          status: 'triggered',
          severity: 'warning',
          actual: 5,
          threshold: 6,
          message: 'Current cash runway is from 3 months to under 6 months.',
        },
        {
          ruleId: 'current_runway_healthy',
          status: 'passed',
          severity: 'info',
          actual: 5,
          threshold: 6,
          message: 'Current cash runway is below the healthy band.',
        },
      ],
    },
    recommendations: [],
  },
}

describe('financial analysis report view', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = jest.fn()
    window.sessionStorage.clear()
  })

  it('hands an eligible immutable report to Scenarios', () => {
    render(<ReportView report={report} />)

    const handoff = screen.getByRole('link', {
      name: 'Test a decision in Scenarios',
    })
    expect(handoff).toHaveAttribute('href', '/dashboard/scenarios')
    expect(handoff).not.toHaveAttribute('aria-disabled', 'true')

    fireEvent.click(handoff)
    expect(JSON.parse(
      window.sessionStorage.getItem('ai-boss-scenario-draft') ?? '{}'
    )).toEqual({ analysisRunId: 'analysis-1' })
  })

  it('disables scenario handoff when the report has no current cash evidence', () => {
    render(<ReportView report={{
      ...report,
      result: {
        ...report.result,
        evidence: report.result.evidence.filter(
          (item) => item.metricKey !== 'cash' || item.reportingDate !== '2026-06-30'
        ),
      },
    }} />)

    expect(screen.getByRole('link', {
      name: 'Test a decision in Scenarios',
    })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText(/A current cash value is required/)).toBeInTheDocument()
  })

  it('renders the dated report identity, prominent result, and screen navigation', () => {
    const { rerender } = render(<ReportView report={report} />)

    expect(screen.getByRole('heading', {
      name: 'Financial Analysis — through 30 Jun 2026',
    })).toBeInTheDocument()
    expect(screen.getByText('NZD · 1 source · 31 Jan 2026 – 30 Jun 2026')).toBeInTheDocument()
    expect(screen.getByText(/Source: statement.csv/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Caution' })).toBeInTheDocument()
    expect(screen.getAllByText('Matched')).toHaveLength(1)
    expect(screen.getAllByText('Not matched')).toHaveLength(2)
    const comparisonTable = screen.getByRole('table', {
      name: 'Financial period comparison',
    })
    expect(within(comparisonTable).getAllByText('-$18,000 · -17.5%')).toHaveLength(2)

    const navigation = screen.getByRole('navigation', { name: 'Report sections' })
    expect(within(navigation).getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Summary',
      'Position',
      'Period comparison',
      'History and forecast',
      'Risks',
      'Actions',
      'Evidence',
    ])

    const singleDateReport: FinancialAnalysisRunView = {
      ...report,
      id: 'analysis-2',
      result: {
        ...report.result,
        selectedBaseline: {
          ...report.result.selectedBaseline,
          reportingPeriodStart: '2026-06-30',
        },
        evidence: report.result.evidence.filter(
          (item) => item.reportingDate === '2026-06-30'
        ),
      },
    }
    rerender(<ReportView report={singleDateReport} />)
    expect(screen.getByRole('heading', {
      name: 'Financial Analysis — as at 30 Jun 2026',
    })).toBeInTheDocument()
  })

  it('opens, filters, and highlights evidence without removing other print rows', async () => {
    render(<ReportView report={report} />)

    fireEvent.click(screen.getByRole('button', {
      name: 'View evidence for Current cash runway',
    }))

    expect(await screen.findByText(/Showing evidence for/)).toHaveTextContent(
      'Showing evidence for Current cash runway'
    )
    expect(screen.getByRole('button', {
      name: /Evidence and processing trace/,
    })).toHaveAttribute('aria-expanded', 'true')

    const evidenceTable = screen.getByRole('table', {
      name: 'Financial analysis evidence',
    })
    expect(within(evidenceTable).getAllByRole('link', {
      name: 'Review source document',
    })[0]).toHaveAttribute('href', '/dashboard/documents/statement-1')
    const cashRow = within(evidenceTable).getByText('$85,000').closest('tr')
    const expenseRow = within(evidenceTable).getByText('Monthly expenses').closest('tr')
    expect(cashRow).toHaveClass('analysis-evidence-highlighted')
    expect(expenseRow).toHaveClass('analysis-evidence-filtered-out')
    expect(expenseRow).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Show all evidence' }))
    expect(expenseRow).not.toHaveClass('analysis-evidence-filtered-out')
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled())
  })
})

describe('financial analysis timeline selection', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('requires a reviewed preview before enabling timeline analysis', async () => {
    const baselines = [
      {
        sourceKey: 'document:statement-1',
        sourceLabel: 'may.csv',
        sourceType: 'document' as const,
        currency: 'NZD' as const,
        availableMetricKeys: ['cash' as const],
        observationCount: 1,
        latestReportingDate: '2026-05-31',
      },
      {
        sourceKey: 'document:statement-2',
        sourceLabel: 'june.csv',
        sourceType: 'document' as const,
        currency: 'NZD' as const,
        availableMetricKeys: ['cash' as const, 'burn_rate' as const],
        observationCount: 2,
        latestReportingDate: '2026-06-30',
      },
    ]
    const preview = {
      mode: 'timeline' as const,
      currency: 'NZD' as const,
      selectedSources: [
        {
          sourceKey: 'document:statement-1',
          sourceLabel: 'may.csv',
          sourceType: 'document' as const,
          documentId: 'statement-1',
          connectionId: null,
        },
        {
          sourceKey: 'document:statement-2',
          sourceLabel: 'june.csv',
          sourceType: 'document' as const,
          documentId: 'statement-2',
          connectionId: null,
        },
      ],
      reportingDates: ['2026-05-31', '2026-06-30'],
      metricCoverage: [{
        reportingDate: '2026-06-30',
        metricKeys: ['cash' as const, 'burn_rate' as const],
        sourceKeys: ['document:statement-2'],
      }],
      warnings: ['Latest-period gaps: accounts_receivable.'],
      suggestedLatestDate: '2026-06-30',
      conflicts: [],
    }
    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/baselines')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { baselines } }),
        } as Response
      }
      if (url.endsWith('/preview') && init?.method === 'POST') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { preview } }),
        } as Response
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { reports: [] } }),
      } as Response
    })
    global.fetch = fetchMock as typeof fetch

    render(<AnalysisWorkspace />)
    await screen.findByRole('heading', { name: 'Full financial analysis' })

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Analysis mode' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Statement timeline' }))
    expect(screen.getByRole('button', { name: 'Run timeline analysis' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', {
      name: 'Select compatible last six months',
    }))
    fireEvent.click(screen.getByRole('button', { name: 'Review timeline' }))

    expect(await screen.findByText('Timeline preview through 30 Jun 2026')).toBeInTheDocument()
    expect(screen.getByText('Latest-period gaps: accounts_receivable.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run timeline analysis' })).toBeEnabled()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/financial-analysis/preview',
      expect.objectContaining({ method: 'POST' })
    )
  })
})
