import { ChatOpenAI } from '@langchain/openai'
import { fillUnavailableMetrics } from '@/lib/financial-data/read-model'
import { readSourceAwareMetrics } from '@/lib/financial-data/read-service'
import { readRunwayObservationHistory } from '@/lib/financial-data/runway-history'
import { readFinancialMetricHistory } from '@/lib/financial-data/metric-history'
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
  readFinancialMetricHistory: jest.fn(),
}))

const mockChatOpenAI = jest.mocked(ChatOpenAI)
const mockReadSourceAwareMetrics = jest.mocked(readSourceAwareMetrics)
const mockReadRunwayObservationHistory = jest.mocked(
  readRunwayObservationHistory
)
const mockReadFinancialMetricHistory = jest.mocked(readFinancialMetricHistory)
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
    })
    mockReadRunwayObservationHistory.mockResolvedValue({
      observations: [],
      direction: 'insufficient_data',
      change: null,
      averageChange: null,
    })
    mockReadFinancialMetricHistory.mockResolvedValue({
      metricKey: 'cash',
      label: 'Cash',
      range: 'all',
      points: [],
      movement: null,
      direction: 'insufficient_data',
      firstValue: null,
      latestValue: null,
      totalChange: null,
      percentageChange: null,
      averageChange: null,
      currency: 'NZD',
      sourceLabels: [],
      hasMixedSources: false,
      hasRecordedDateFallback: false,
      hasIncompatibleCurrencies: false,
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
    mockPlannerInvoke.mockResolvedValue({
      widgets: [
        {
          type: 'metric_snapshot',
          title: 'Affordability signals',
          reason: 'These metrics help assess affordability.',
          metricKeys: ['cash', 'burn_rate'],
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
    expect(plan?.widgets).toHaveLength(1)
    expect(plan?.widgets[0]).toMatchObject({
      type: 'metric_snapshot',
      title: 'Affordability signals',
    })
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
    mockReadFinancialMetricHistory.mockResolvedValue({
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
    } as never)

    const plan = await planGenUi({
      userId: 'user-123',
      userMessage: 'How has our cash changed over time?',
      assistantMessage: 'Cash has increased.',
      toolsUsed: [],
    })

    expect(mockReadFinancialMetricHistory).toHaveBeenCalledWith({
      userId: 'user-123',
      metricKey: 'cash',
      range: 'all',
    })
    expect(plan?.widgets).toContainEqual(
      expect.objectContaining({ type: 'metric_trend_chart' })
    )
  })
})
