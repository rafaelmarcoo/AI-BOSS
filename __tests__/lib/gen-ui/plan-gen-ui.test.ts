import { ChatOpenAI } from '@langchain/openai'
import { fillUnavailableMetrics } from '@/lib/financial-data/read-model'
import { readSourceAwareMetrics } from '@/lib/financial-data/read-service'
import { readRunwayObservationHistory } from '@/lib/financial-data/runway-history'
import { readFinancialMetricHistorySeries } from '@/lib/financial-data/metric-history'
import { readFinancialMetricForecastSeries } from '@/lib/financial-data/metric-forecast'
import { getGenUiPersonalization } from '@/lib/gen-ui/preferences-persistence'
import { planGenUi } from '@/lib/gen-ui/plan-gen-ui'

const mockPlannerInvoke = jest.fn()
const mockWithStructuredOutput = jest.fn(() => ({
  invoke: mockPlannerInvoke,
}))

jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    withStructuredOutput: mockWithStructuredOutput,
  })),
}))

jest.mock('@/lib/financial-data/read-service', () => ({
  readSourceAwareMetrics: jest.fn(),
}))

jest.mock('@/lib/financial-data/runway-history', () => ({
  readRunwayObservationHistory: jest.fn(),
  getMetricObservationDate: jest.fn((metric) => metric.updatedAt),
}))

jest.mock('@/lib/financial-data/metric-history', () => ({
  readFinancialMetricHistorySeries: jest.fn(),
}))
jest.mock('@/lib/financial-data/metric-forecast', () => ({
  readFinancialMetricForecastSeries: jest.fn(),
}))
jest.mock('@/lib/gen-ui/preferences-persistence', () => ({
  getGenUiPersonalization: jest.fn(),
}))

const mockChatOpenAI = jest.mocked(ChatOpenAI)
const mockReadSourceAwareMetrics = jest.mocked(readSourceAwareMetrics)
const mockReadRunwayObservationHistory = jest.mocked(
  readRunwayObservationHistory
)
const mockReadFinancialMetricHistorySeries = jest.mocked(readFinancialMetricHistorySeries)
const mockReadFinancialMetricForecastSeries = jest.mocked(readFinancialMetricForecastSeries)
const mockGetGenUiPersonalization = jest.mocked(getGenUiPersonalization)
const originalApiKey = process.env.OPENAI_API_KEY

describe('planGenUi', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.OPENAI_API_KEY = 'test-api-key'

    const metrics = fillUnavailableMetrics({})
    mockReadSourceAwareMetrics.mockResolvedValue({
      metrics,
      availableMetricCount: 0,
      unavailableMetricCount: Object.keys(metrics).length,
      runwayInput: null,
      workingCapitalAdjustedRunway: metrics.runway_months,
    })
    mockReadRunwayObservationHistory.mockResolvedValue({
      observations: [],
      direction: 'insufficient_data',
      change: null,
      averageChange: null,
      workingCapitalAdjusted: {
        observations: [],
        direction: 'insufficient_data',
        change: null,
        averageChange: null,
      },
    })
    mockReadFinancialMetricHistorySeries.mockResolvedValue({
      metricKey: 'cash',
      label: 'Cash',
      range: 'all',
      recordLimit: 'all',
      selectedCurrency: null,
      selectedSourceKey: null,
      availableCurrencies: [],
      availableSources: [],
      series: [],
      excludedCurrencyObservationCount: 0,
      hasMissingCurrencyObservations: false,
      unsupportedCurrencies: [],
    } as never)
    mockReadFinancialMetricForecastSeries.mockResolvedValue({
      metricKey: 'cash', label: 'Cash', range: 'all', recordLimit: 'all', selectedCurrency: null, selectedSourceKey: null, availableCurrencies: ['NZD'], availableSources: [], excludedCurrencyObservationCount: 0, hasMissingCurrencyObservations: false, unsupportedCurrencies: [], horizon: 3,
      series: [{ history: {
        metricKey: 'cash', label: 'Cash', range: 'all',
        points: [
          { date: '2026-05-01', dateSource: 'as_of_date', value: 100, currency: 'NZD', sourceLabel: 'May CSV', sourceType: 'document', confidence: 0.9, updatedAt: '2026-05-01T00:00:00.000Z' },
          { date: '2026-06-01', dateSource: 'as_of_date', value: 120, currency: 'NZD', sourceLabel: 'June CSV', sourceType: 'document', confidence: 0.9, updatedAt: '2026-06-01T00:00:00.000Z' },
        ], movement: 'increased', direction: 'improving', firstValue: 100, latestValue: 120, totalChange: 20, percentageChange: 20, averageChange: 20, currency: 'NZD', sourceLabels: ['May CSV', 'June CSV'], hasMixedSources: true, hasRecordedDateFallback: false, hasIncompatibleCurrencies: false, excludedCurrencyObservationCount: 0, hasMissingCurrencyObservations: false, unsupportedCurrencies: [],
      },
      forecastPoints: [{ date: '2026-07-01', value: 140, kind: 'forecast' }], latestActualValue: 120, monthlySlope: 20, method: 'date_aware_linear_trend', assumptions: [],
      metricKey: 'cash', label: 'Cash', range: 'all', horizon: 3,
      }],
    } as never)
    mockGetGenUiPersonalization.mockResolvedValue({
      businessSize: null,
      canEditBusinessSize: false,
      decisionRole: 'owner',
      priorityTopics: [],
      detailLevel: 'balanced',
      planningHorizon: 6,
      learnFromHistory: false,
    })
  })

  afterAll(() => {
    if (originalApiKey === undefined) {
      delete process.env.OPENAI_API_KEY
    } else {
      process.env.OPENAI_API_KEY = originalApiKey
    }
  })

  it('lets the model select widgets for requests outside the keyword fallback', async () => {
    const metrics = fillUnavailableMetrics({
      cash: {
        status: 'available',
        key: 'cash',
        value: 120000,
        currency: 'NZD',
        periodStart: null,
        periodEnd: null,
        asOfDate: '2026-08-31',
        provenance: {
          sourceType: 'document',
          sourceLabel: 'cash-summary.csv',
        },
        confidence: 0.95,
        updatedAt: '2026-08-31T00:00:00.000Z',
      },
      runway_months: {
        status: 'available',
        key: 'runway_months',
        value: 8.4,
        currency: null,
        periodStart: null,
        periodEnd: null,
        asOfDate: '2026-08-31',
        provenance: {
          sourceType: 'document',
          sourceLabel: 'cash-summary.csv',
        },
        confidence: 0.9,
        updatedAt: '2026-08-31T00:00:00.000Z',
      },
    })
    mockReadSourceAwareMetrics.mockResolvedValue({
      metrics,
      availableMetricCount: 2,
      unavailableMetricCount: Object.keys(metrics).length - 2,
      runwayInput: null,
      workingCapitalAdjustedRunway: metrics.runway_months,
    })
    mockPlannerInvoke.mockResolvedValue({
      widgets: [
        {
          widgetId: 'current_cash_balance',
          title: 'Available cash',
          reason: 'Cash helps assess affordability.',
        },
        {
          widgetId: 'cash_runway',
          title: 'Current runway',
          reason: 'Runway shows how much operating time remains.',
        },
      ],
    })

    const plan = await planGenUi({
      userId: 'user-123',
      userMessage: 'Could we afford another team member?',
      assistantMessage: 'Review the impact on your monthly position.',
      toolsUsed: [],
    })

    expect(mockChatOpenAI).toHaveBeenCalled()
    expect(mockWithStructuredOutput).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: 'jsonSchema', strict: true })
    )
    expect(mockPlannerInvoke).toHaveBeenCalled()
    const plannerMessages = mockPlannerInvoke.mock.calls[0][0]
    expect(String(plannerMessages[1].content)).toContain('current_cash_balance')
    expect(String(plannerMessages[1].content)).not.toContain('overdue_invoices')
    expect(plan?.widgets).toHaveLength(2)
    expect(plan?.widgets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'metric_snapshot',
          title: 'Available cash',
          data: { metrics: [expect.objectContaining({ key: 'cash' })] },
        }),
        expect.objectContaining({
          type: 'metric_snapshot',
          title: 'Current runway',
          data: { metrics: [expect.objectContaining({ key: 'runway_months' })] },
        }),
      ])
    )
  })

  it('respects an intentional empty widget selection from the model', async () => {
    mockPlannerInvoke.mockResolvedValue({ widgets: [] })

    const plan = await planGenUi({
      userId: 'user-123',
      userMessage: 'Tell me a joke about cash.',
      assistantMessage: 'Why did the cash cross the road?',
      toolsUsed: [],
    })

    expect(plan).toBeNull()
  })

  it('uses explicit profile settings as tie-breakers without removing eligible widgets', async () => {
    const metrics = fillUnavailableMetrics({
      cash: {
        status: 'available', key: 'cash', value: 120000, currency: 'NZD',
        periodStart: null, periodEnd: null, asOfDate: '2026-08-31',
        provenance: { sourceType: 'document', sourceLabel: 'cash-summary.csv' },
        confidence: 0.95, updatedAt: '2026-08-31T00:00:00.000Z',
      },
    })
    mockReadSourceAwareMetrics.mockResolvedValue({
      metrics,
      availableMetricCount: 1,
      unavailableMetricCount: Object.keys(metrics).length - 1,
      runwayInput: null,
      workingCapitalAdjustedRunway: metrics.runway_months,
    })
    mockGetGenUiPersonalization.mockResolvedValue({
      businessSize: 'large',
      canEditBusinessSize: true,
      decisionRole: 'finance',
      priorityTopics: ['forecasting', 'cost_control'],
      detailLevel: 'quick',
      planningHorizon: 12,
      learnFromHistory: false,
    })
    mockPlannerInvoke.mockResolvedValue({ widgets: [] })

    await planGenUi({
      userId: 'user-123',
      userMessage: 'Give me a quick view of our cash position.',
      assistantMessage: 'Here is the latest cash position.',
      toolsUsed: [],
    })

    const plannerMessages = mockPlannerInvoke.mock.calls[0][0]
    const systemPrompt = String(plannerMessages[0].content)
    const plannerPayload = String(plannerMessages[1].content)
    expect(systemPrompt).toContain('Choose 0 to 2 widgets')
    expect(plannerPayload).toContain('"businessSize":"large"')
    expect(plannerPayload).toContain('"decisionRole":"finance"')
    expect(plannerPayload).toContain('"usualPlanningHorizonMonths":12')
    expect(plannerPayload).toContain('current_cash_balance')
  })

  it('discards a model selection that was not in the eligible candidates', async () => {
    mockPlannerInvoke.mockResolvedValue({
      widgets: [
        {
          widgetId: 'overdue_invoices',
          title: 'Overdue invoices',
          reason: 'This would require invoice-level data.',
        },
      ],
    })

    const plan = await planGenUi({
      userId: 'user-123',
      userMessage: 'Show the source data for my invoices.',
      assistantMessage: 'Invoice details are not currently available.',
      toolsUsed: [],
    })

    expect(plan).toBeNull()
  })

  it('limits unreviewed document evidence to a focused review workspace', async () => {
    const plan = await planGenUi({
      userId: 'user-123',
      userMessage: 'What does 01-valid-nzd-history.csv say about cash?',
      assistantMessage: 'The unreviewed document lists three exact cash values.',
      toolsUsed: [],
      hasUnreviewedDocumentEvidence: true,
      unreviewedDocumentIds: ['9d36fa7e-77a3-49dc-be8c-5074a80797db'],
    })

    expect(plan).toMatchObject({
      workspaceMode: 'document_review',
      documentReviewSnapshot: {
        documentIds: ['9d36fa7e-77a3-49dc-be8c-5074a80797db'],
        statusAtGeneration: 'pending',
      },
      widgets: [
        expect.objectContaining({
          type: 'data_connections',
          title: 'Review document values',
        }),
      ],
    })
    expect(mockChatOpenAI).not.toHaveBeenCalled()
    expect(mockReadSourceAwareMetrics).not.toHaveBeenCalled()
    expect(mockReadRunwayObservationHistory).not.toHaveBeenCalled()
    expect(mockReadFinancialMetricHistorySeries).not.toHaveBeenCalled()
  })

  it('shows deterministically calculated runway as available source evidence', async () => {
    const calculatedRunway = {
      status: 'available' as const,
      key: 'runway_months' as const,
      value: 4.71,
      currency: null,
      periodStart: null,
      periodEnd: null,
      asOfDate: '2026-05-31',
      provenance: {
        sourceType: 'document' as const,
        sourceLabel: '01-valid-nzd-history.csv (cash runway calculated)',
        sourceId: 'document-123',
        evidence: {
          excerpt: '80000 / 17000 = 4.71 months',
        },
      },
      confidence: 0.95,
      updatedAt: '2026-05-31T00:00:00.000Z',
    }
    const adjustedRunway = {
      ...calculatedRunway,
      value: 4.82,
      provenance: {
        ...calculatedRunway.provenance,
        sourceLabel:
          '01-valid-nzd-history.csv (working-capital-adjusted runway calculated)',
        evidence: {
          excerpt: '(80000 + 16000 - 14000) / 17000 = 4.82 months',
        },
      },
    }
    const metrics = fillUnavailableMetrics({ runway_months: calculatedRunway })
    mockReadSourceAwareMetrics.mockResolvedValue({
      metrics,
      availableMetricCount: 1,
      unavailableMetricCount: 6,
      runwayInput: { cash: 80000, ar: 16000, ap: 14000, burn: 17000 },
      workingCapitalAdjustedRunway: adjustedRunway,
    })
    mockPlannerInvoke.mockResolvedValue({
      widgets: [{
        widgetId: 'utility_metric_source_evidence',
        title: 'Source evidence',
        reason: 'Show the confirmed calculation source.',
      }],
    })

    const plan = await planGenUi({
      userId: 'user-123',
      userMessage: 'Show the source evidence for my current financial values.',
      assistantMessage: 'Current values are confirmed.',
      toolsUsed: [],
    })

    expect(plan?.widgets[0]).toMatchObject({
      type: 'metric_source_evidence',
      data: {
        metrics: expect.arrayContaining([
          expect.objectContaining({
            label: 'Cash runway',
            value: '4.71 months',
            sourceLabel: '01-valid-nzd-history.csv (cash runway calculated)',
            tone: 'derived',
          }),
          expect.objectContaining({
            label: 'Working-capital-adjusted runway',
            value: '4.82 months',
            tone: 'derived',
          }),
        ]),
      },
    })
  })

  it('labels dated runway inputs as used, compatible, contextual, or unavailable', async () => {
    const metric = (
      key:
        | 'cash'
        | 'accounts_receivable'
        | 'accounts_payable'
        | 'burn_rate'
        | 'monthly_expenses',
      value: number,
      asOfDate: string
    ) => ({
      status: 'available' as const,
      key,
      value,
      currency: 'NZD',
      periodStart: null,
      periodEnd: null,
      asOfDate,
      provenance: {
        sourceType: 'document' as const,
        sourceLabel: '01-valid-nzd-history.csv',
        sourceId: 'document-123',
      },
      confidence: 0.95,
      updatedAt: '2026-06-01T00:00:00.000Z',
    })
    const cashRunway = {
      status: 'available' as const,
      key: 'runway_months' as const,
      value: 5.88,
      currency: null,
      periodStart: null,
      periodEnd: null,
      asOfDate: '2026-05-31',
      provenance: {
        sourceType: 'document' as const,
        sourceLabel: '01-valid-nzd-history.csv (cash runway calculated)',
        sourceId: 'document-123',
      },
      confidence: 0.95,
      updatedAt: '2026-06-01T00:00:00.000Z',
    }
    const metrics = fillUnavailableMetrics({
      cash: metric('cash', 100000, '2026-05-31'),
      accounts_receivable: metric('accounts_receivable', 18000, '2026-04-30'),
      accounts_payable: metric('accounts_payable', 14000, '2026-05-31'),
      burn_rate: metric('burn_rate', 17000, '2026-05-31'),
      monthly_expenses: metric('monthly_expenses', 63000, '2026-05-31'),
      runway_months: cashRunway,
    })
    mockReadSourceAwareMetrics.mockResolvedValue({
      metrics,
      availableMetricCount: 6,
      unavailableMetricCount: 1,
      runwayInput: null,
      workingCapitalAdjustedRunway: {
        status: 'unavailable',
        key: 'runway_months',
        reason: 'incompatible_reporting_date',
        sourceType: null,
        sourceLabel: null,
        updatedAt: null,
        detail:
          'Cannot calculate working-capital-adjusted runway because accounts receivable for 2026-05-31 was explicitly excluded during document review.',
      },
    })
    mockPlannerInvoke.mockResolvedValue({
      widgets: [
        {
          widgetId: 'cash_runway',
          title: 'Runway values',
          reason: 'All of these values were used in the calculation.',
        },
        {
          widgetId: 'utility_metric_source_evidence',
          title: 'Source and dates',
          reason: 'All values were used.',
        },
      ],
    })

    const plan = await planGenUi({
      userId: 'user-123',
      userMessage:
        'Calculate both my cash runway and working-capital-adjusted runway, and show the source evidence.',
      assistantMessage: 'Cash runway is 5.88 months; adjusted runway is unavailable.',
      toolsUsed: [],
    })

    expect(plan?.widgets[0]).toMatchObject({
      type: 'metric_snapshot',
      reason: expect.stringContaining('reporting dates'),
      data: {
        metrics: expect.arrayContaining([
          expect.objectContaining({
            key: 'cash',
            reportingDate: '2026-05-31',
            dateStatus: 'latest_recorded',
            calculationRole: 'used',
          }),
          expect.objectContaining({
            key: 'burn_rate',
            reportingDate: '2026-05-31',
            calculationRole: 'used',
          }),
          expect.objectContaining({
            key: 'runway_months',
            reportingDate: '2026-05-31',
            dateStatus: 'calculated_for',
            calculationRole: 'derived',
          }),
          expect.objectContaining({
            key: 'runway_months',
            runwayVariant: 'working_capital_adjusted',
            reportingDate: '2026-05-31',
            calculationRole: 'unavailable',
          }),
        ]),
      },
    })
    expect(
      plan?.widgets[0].type === 'metric_snapshot'
        ? plan.widgets[0].data.metrics.map((metric) => metric.key)
        : []
    ).toEqual(['cash', 'burn_rate', 'runway_months', 'runway_months'])
    expect(
      plan?.widgets[0].type === 'metric_snapshot'
        ? plan.widgets[0].data.metrics
        : []
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'monthly_expenses' }),
      ])
    )
    expect(plan?.widgets[0].reason).not.toContain('All of these values were used')
    expect(plan?.widgets[1]).toMatchObject({
      type: 'metric_source_evidence',
      data: {
        metrics: expect.arrayContaining([
          expect.objectContaining({
            label: 'Accounts receivable',
            reportingDate: '2026-04-30',
            calculationRole: 'context_only',
          }),
          expect.objectContaining({
            label: 'Working-capital-adjusted runway',
            reportingDate: '2026-05-31',
            dateStatus: 'unavailable_for',
            calculationRole: 'unavailable',
            detail: expect.stringContaining('explicitly excluded'),
          }),
        ]),
      },
    })
  })

  it('uses deterministic selection only when model planning fails', async () => {
    const plannerError = new Error('planner unavailable')
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
    mockPlannerInvoke.mockRejectedValue(plannerError)

    const plan = await planGenUi({
      userId: 'user-123',
      userMessage: 'What is my runway?',
      assistantMessage: 'Runway data is currently incomplete.',
      toolsUsed: [],
    })

    expect(plan?.widgets.some((widget) => widget.type === 'metric_snapshot')).toBe(
      true
    )
    expect(consoleError).toHaveBeenCalledWith(
      'Gen UI widget planning failed; using deterministic fallback selection.',
      plannerError
    )

    consoleError.mockRestore()
  })

  it('always includes a deterministic trend widget for a metric-specific historical question', async () => {
    mockPlannerInvoke.mockResolvedValue({ widgets: [] })
    mockReadFinancialMetricHistorySeries.mockResolvedValue({
      metricKey: 'cash', label: 'Cash', range: 'all', recordLimit: 'all', selectedCurrency: null, selectedSourceKey: null, availableCurrencies: ['NZD'], availableSources: [], excludedCurrencyObservationCount: 0, hasMissingCurrencyObservations: false, unsupportedCurrencies: [], series: [{
      metricKey: 'cash',
      label: 'Cash',
      range: 'all',
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
    }] } as never)

    const plan = await planGenUi({
      userId: 'user-123',
      userMessage: 'How has our cash changed over time?',
      assistantMessage: 'Cash has increased.',
      toolsUsed: [],
    })

    expect(mockReadFinancialMetricHistorySeries).toHaveBeenCalledWith({
      userId: 'user-123',
      metricKey: 'cash',
      range: 'all',
      recordLimit: 'all',
    })
    expect(plan?.widgets).toContainEqual(
      expect.objectContaining({ type: 'metric_trend_chart' })
    )
  })

  it('always includes a deterministic forecast widget for a metric-specific forecast question', async () => {
    mockPlannerInvoke.mockResolvedValue({ widgets: [] })

    const plan = await planGenUi({
      userId: 'user-123',
      userMessage: 'Forecast our cash for the next 6 months.',
      assistantMessage: 'Here is the deterministic forecast.',
      toolsUsed: [],
    })

    expect(mockReadFinancialMetricForecastSeries).toHaveBeenCalledWith({
      userId: 'user-123', metricKey: 'cash', range: 'all', horizon: 6, recordLimit: 'all',
    })
    expect(plan?.widgets).toContainEqual(
      expect.objectContaining({ type: 'metric_forecast_chart' })
    )
  })

  it('hydrates scenario UI from the exact validated tool result and ignores legacy model comparisons', async () => {
    mockPlannerInvoke.mockResolvedValue({
      widgets: [{ widgetId: 'scenario_comparison_table', title: 'Invented comparison', reason: 'Legacy selection' }],
    })
    const scenarioResult = {
      input: {
        sourceKey: 'document:doc-1', currency: 'NZD', horizon: 3, trendRange: '6m', manualBaseline: {},
        scenarios: [{ id: 'hire', label: 'Hire', adjustments: [{
          id: 'cost', label: 'Employer cost', kind: 'fixed', flow: 'outflow', frequency: 'recurring',
          amount: 8000, startMonth: '2026-06',
        }] }],
      },
      currency: 'NZD', sourceKey: 'document:doc-1', sourceLabel: 'statement.csv',
      projectionStartMonth: '2026-06', openingLiquidity: 100000,
      openingBridge: { cash: 100000, accountsReceivable: 0, accountsPayable: 0, formula: '100000 + 0 - 0 = 100000' },
      panels: [{ method: 'current_run_rate', label: 'Current run rate', available: true, unavailableReason: null, baselineMonthlyMovement: -10000, series: [] }],
      assumptions: [], warnings: [], metricInputs: {}, calculatedAt: '2026-06-01T00:00:00Z',
    }

    const plan = await planGenUi({
      userId: 'user-123', userMessage: 'Compare hiring someone', assistantMessage: 'Calculated.',
      toolsUsed: [{ tool: 'model_scenario', args: scenarioResult.input }],
      toolExecutions: [{ tool: 'model_scenario', args: scenarioResult.input, result: { status: 'ready', result: scenarioResult } }],
      scenarioMode: true,
    })

    expect(plan?.widgets).toHaveLength(1)
    expect(plan?.widgets[0]).toMatchObject({
      type: 'scenario_analysis',
      data: { result: scenarioResult, editHref: '/dashboard/scenarios' },
    })
    expect(mockPlannerInvoke).not.toHaveBeenCalled()
  })

  it('does not create generic financial widgets for scenario prose without a trusted result', async () => {
    const plan = await planGenUi({
      userId: 'user-123',
      userMessage: 'Compare hiring with buying equipment',
      assistantMessage: 'An untrusted model-written calculation.',
      toolsUsed: [],
      toolExecutions: [],
      scenarioMode: true,
    })

    expect(plan).toBeNull()
    expect(mockPlannerInvoke).not.toHaveBeenCalled()
    expect(mockReadSourceAwareMetrics).not.toHaveBeenCalled()
  })
})
