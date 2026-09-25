import { AIMessage } from '@langchain/core/messages'
import { ChatOpenAI } from '@langchain/openai'
import {
  buildExecutiveFallback,
  buildFinancialPositionFallback,
  buildTrendForecastFallback,
  runFinancialPositionAgent,
} from '@/lib/financial-analysis/agents'
import type { FinancialAnalysisCollection } from '@/lib/financial-analysis/collector'
import {
  FINANCIAL_ANALYSIS_COMPARISON_METRIC_KEYS,
  FINANCIAL_ANALYSIS_SECTION_IDS,
} from '@/lib/financial-analysis/types'

const mockInvoke = jest.fn()
const mockWithStructuredOutput = jest.fn(() => ({ invoke: mockInvoke }))

jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    withStructuredOutput: mockWithStructuredOutput,
  })),
}))

const mockChatOpenAI = jest.mocked(ChatOpenAI)

const collection: FinancialAnalysisCollection = {
  selection: {
    mode: 'single',
    sourceKey: 'document:document-1',
    sourceLabel: 'statement.csv',
    sourceKeys: ['document:document-1'],
    sources: [{
      sourceKey: 'document:document-1',
      sourceLabel: 'statement.csv',
      sourceType: 'document',
      documentId: 'document-1',
      connectionId: null,
    }],
    currency: 'NZD',
    reportingPeriodStart: '2026-06-30',
    reportingPeriodEnd: '2026-06-30',
    reportDate: '2026-06-30',
  },
  readiness: {
    status: 'limited',
    availableMetricKeys: ['cash', 'burn_rate', 'runway_months'],
    missingMetricKeys: [
      'accounts_receivable',
      'accounts_payable',
      'monthly_revenue',
      'monthly_expenses',
    ],
    historicalObservationCount: 1,
    reasons: ['More comparable data is required.'],
  },
  sections: FINANCIAL_ANALYSIS_SECTION_IDS.map((sectionId) => ({
    sectionId,
    status: 'limited' as const,
    reason: 'More comparable data is required.',
  })),
  facts: {
    operatingBalance: null,
    receivablesPayables: null,
    runway: {
      cash: 80000,
      monthlyBurnRate: 20000,
      cashRunwayMonths: 4,
      cashRunwayFormula: '80000 / 20000 = 4 months',
      accountsReceivable: null,
      accountsPayable: null,
      workingCapitalAdjustedRunwayMonths: null,
      workingCapitalAdjustedRunwayFormula: null,
    },
    history: [],
    forecasts: [],
    periodComparisons: FINANCIAL_ANALYSIS_COMPARISON_METRIC_KEYS.map((metricKey) => ({
      metricKey,
      earliest: null,
      previous: null,
      latest: null,
      startToLatestChange: null,
      previousToLatestChange: null,
      unavailableReason: 'Comparison unavailable.',
    })),
  },
  evidence: [],
  assumptions: ['No currency conversion was performed.'],
  baselineFingerprint: [],
}

describe('financial analysis agents', () => {
  const originalApiKey = process.env.OPENAI_API_KEY

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.OPENAI_API_KEY = 'test-api-key'
  })

  afterAll(() => {
    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = originalApiKey
  })

  it('uses strict structured output and records model/token metadata', async () => {
    mockInvoke.mockResolvedValue({
      raw: new AIMessage({
        content: '',
        response_metadata: { model_name: 'resolved-test-model' },
        usage_metadata: {
          input_tokens: 10,
          output_tokens: 5,
          total_tokens: 15,
        },
      }),
      parsed: {
        summary: 'The selected baseline has four months of cash runway.',
        risks: ['Runway is below six months.'],
        limitations: ['Working-capital-adjusted runway is unavailable.'],
      },
    })

    await expect(runFinancialPositionAgent(collection)).resolves.toMatchObject({
      model: 'resolved-test-model',
      tokensUsed: 15,
      output: { summary: expect.stringContaining('four months') },
    })
    expect(mockChatOpenAI).toHaveBeenCalledTimes(1)
    expect(mockWithStructuredOutput).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        name: 'financial_position_analysis',
        method: 'jsonSchema',
        strict: true,
        includeRaw: true,
      })
    )
    const messages = mockInvoke.mock.calls[0][0]
    expect(messages[0].content).toContain('Never call it profit')
    expect(messages[1].content).not.toContain('privateSourcePayload')
  })

  it('fails closed when the API key is unavailable', async () => {
    delete process.env.OPENAI_API_KEY

    await expect(runFinancialPositionAgent(collection)).rejects.toMatchObject({
      status: 500,
      code: 'INTERNAL_ERROR',
    })
    expect(mockChatOpenAI).not.toHaveBeenCalled()
  })

  it('builds complete deterministic specialist and executive fallbacks', () => {
    const position = buildFinancialPositionFallback(collection)
    const trend = buildTrendForecastFallback(collection)
    const executive = buildExecutiveFallback({
      collection,
      financialPosition: position,
      trendForecast: trend,
      policy: {
        policyVersion: 'mvp-v1',
        decision: 'warn',
        triggeredRuleIds: ['current_runway_caution'],
        rules: [{
          ruleId: 'current_runway_caution',
          status: 'triggered',
          severity: 'warning',
          actual: 4,
          threshold: 6,
          message: 'Current cash runway is from 3 months to under 6 months.',
        }],
      },
    })

    expect(position.summary).toContain('Cash is NZD 80,000')
    expect(position.summary).toContain('operating balance')
    expect(position.summary.toLowerCase()).not.toContain('profit')
    expect(trend.summary).toContain('No comparable six-month history')
    expect(executive.executiveSummary).toContain(position.summary)
    expect(executive.risks).toContain(
      'Current cash runway is from 3 months to under 6 months.'
    )
  })
})
