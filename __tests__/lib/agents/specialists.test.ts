import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages'
import { runAgent } from '@/lib/ai/agent'
import { runMultiAgent } from '@/lib/agents/specialists'
import { DEFAULT_MODEL } from '@/lib/ai/models'

jest.mock('@/lib/ai/agent', () => ({
  runAgent: jest.fn(),
}))

jest.mock('@/lib/tools/financial/calculate-runway', () => ({
  calculateRunwayTool: { name: 'calculate_runway' },
}))
jest.mock('@/lib/tools/financial/get-latest-snapshot', () => ({
  createGetLatestSnapshotTool: jest.fn(() => ({ name: 'get_latest_snapshot' })),
}))
jest.mock('@/lib/tools/financial/get-financial-history', () => ({
  createGetFinancialHistoryTool: jest.fn(() => ({ name: 'get_financial_history' })),
}))
jest.mock('@/lib/tools/financial/get-financial-forecast', () => ({
  createGetFinancialForecastTool: jest.fn(() => ({ name: 'get_financial_forecast' })),
}))
jest.mock('@/lib/tools/financial/model-scenario', () => ({
  createModelScenarioTool: jest.fn(() => ({ name: 'model_scenario' })),
}))
jest.mock('@/lib/tools/financial/calculate-ratios', () => ({
  createCalculateRatiosTool: jest.fn(() => ({ name: 'calculate_ratios' })),
}))
jest.mock('@/lib/tools/financial/combine-financial-sources', () => ({
  createCombineFinancialSourcesTool: jest.fn(() => ({ name: 'combine_financial_sources' })),
}))
jest.mock('@/lib/tools/financial/list-analysed-companies', () => ({
  createListAnalysedCompaniesTool: jest.fn(() => ({ name: 'list_analysed_companies' })),
}))
jest.mock('@/lib/tools/financial/analyse-company', () => ({
  createAnalyseCompanyTool: jest.fn(() => ({ name: 'analyse_company' })),
}))
jest.mock('@/lib/tools/financial/compare-companies', () => ({
  createCompareCompaniesTool: jest.fn(() => ({ name: 'compare_companies' })),
}))

const mockRunAgent = jest.mocked(runAgent)

describe('runMultiAgent', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.OPENAI_API_KEY = 'test-openai-key'
  })

  it('uses only history and forecast tools for a forecast request', async () => {
    mockRunAgent.mockResolvedValue({ content: 'Forecast result', tokensUsed: 12, toolsUsed: [] })
    const context = [new SystemMessage('financial context')]

    const result = await runMultiAgent('user-123', 'Forecast cash for 6 months', [], context)

    expect(result.specialist).toBe('historical_forecast')
    expect(mockRunAgent).toHaveBeenCalledWith(
      'Forecast cash for 6 months',
      [],
      expect.arrayContaining([
        expect.objectContaining({ name: 'get_financial_history' }),
        expect.objectContaining({ name: 'get_financial_forecast' }),
      ]),
      context,
      expect.stringContaining('historical review and deterministic forecasts only'),
      DEFAULT_MODEL
    )
    expect(result.modelName).toBe(DEFAULT_MODEL)
    const tools = mockRunAgent.mock.calls[0][2]!
    expect(tools.map((tool) => tool.name)).not.toContain('model_scenario')
    expect(tools.map((tool) => tool.name)).not.toContain('calculate_runway')
    expect(mockRunAgent.mock.calls[0][4]).toContain('preserve both in the final answer')
  })

  it('uses only the scenario tool for a percentage burn scenario', async () => {
    mockRunAgent.mockResolvedValue({
      content: 'Which month?', tokensUsed: 8,
      toolsUsed: [{ tool: 'model_scenario', args: {} }],
      toolExecutions: [{ tool: 'model_scenario', args: {}, result: { status: 'needs_input', message: 'Which month should the reduction start?' } }],
    })

    const result = await runMultiAgent('user-123', 'Cut our burn by 20%')

    expect(result.specialist).toBe('scenario')
    const tools = mockRunAgent.mock.calls[0][2]!
    expect(tools.map((tool) => tool.name)).toEqual(['model_scenario'])
    expect(mockRunAgent.mock.calls[0][4]).toContain('Never calculate financial results yourself')
  })

  it('routes ambiguous and revenue percentages to the scenario specialist for clarification or modelling', async () => {
    mockRunAgent.mockResolvedValue({ content: 'Which month should this start?', tokensUsed: 8, toolsUsed: [] })
    const ambiguous = await runMultiAgent('user-123', 'Cut it by 20%')
    const revenue = await runMultiAgent('user-123', 'What if revenue grows by 20%?')

    expect(ambiguous.specialist).toBe('scenario')
    expect(revenue.specialist).toBe('scenario')
    expect(mockRunAgent).toHaveBeenCalledTimes(2)
    expect(mockRunAgent.mock.calls[0][4]).toContain('Ask only one focused question')
  })

  it('keeps a confirmation reply in the scenario specialist', async () => {
    mockRunAgent.mockResolvedValue({ content: 'Which source should I use?', tokensUsed: 8, toolsUsed: [] })
    const result = await runMultiAgent(
      'user-123',
      '1. NZD 2. yes 3. recurring 4. six months',
      [new AIMessage('Which source/currency should I use for this scenario?')]
    )
    expect(result.specialist).toBe('scenario')
    expect(mockRunAgent.mock.calls[0][2]!.map((tool) => tool.name)).toEqual(['model_scenario'])
  })

  it('retries the trusted tool when a complete comparison gets an unnecessary question', async () => {
    mockRunAgent
      .mockResolvedValueOnce({ content: 'Should I use a six-month horizon?', tokensUsed: 8, toolsUsed: [] })
      .mockResolvedValueOnce({
        content: 'Waiting for a source.',
        tokensUsed: 9,
        toolsUsed: [{ tool: 'model_scenario', args: {} }],
        toolExecutions: [{
          tool: 'model_scenario',
          args: {},
          result: { status: 'needs_input', message: 'Which source and currency should I use?' },
        }],
      })

    const result = await runMultiAgent(
      'user-123',
      'Compare hiring a salesperson for NZD 8,000 per month from October with buying NZD 50,000 of equipment in November.'
    )

    expect(mockRunAgent).toHaveBeenCalledTimes(2)
    expect(mockRunAgent.mock.calls[1][4]).toContain('Mandatory scenario tool retry')
    expect(result.content).toBe('Which source and currency should I use?')
  })

  it('blocks salary-only staffing calculations until a monthly employer cost or saving is confirmed', async () => {
    const result = await runMultiAgent('user-123', 'What if I fire someone earning NZD 80,000 annually?')
    expect(result.specialist).toBe('scenario')
    expect(result.content).toContain('confirmed total monthly employer cost or monthly saving')
    expect(result.content).toContain('one-off cash adjustments')
    expect(mockRunAgent).not.toHaveBeenCalled()
  })

  it('repeats the safeguard when the user refuses to confirm monthly firing savings', async () => {
    const result = await runMultiAgent('user-123', 'Nothing, just firing someone earning NZD 80,000 annually.')
    expect(result.content).toContain('confirmed total monthly employer cost or monthly saving')
    expect(mockRunAgent).not.toHaveBeenCalled()
  })

  it('asks for a firing start month after the monthly saving is confirmed', async () => {
    const result = await runMultiAgent(
      'user-123',
      '6600 monthly costs and nothing else',
      [
        new HumanMessage('What if I fire someone earning NZD 80,000 annually?'),
        new AIMessage('What is the confirmed total monthly employer cost or monthly saving to model?'),
      ]
    )

    expect(result.specialist).toBe('scenario')
    expect(result.content).toBe('Which month should the confirmed monthly saving start?')
    expect(mockRunAgent).not.toHaveBeenCalled()
  })

  describe('per-specialist model selection', () => {
    const originalSpecialistModel = process.env.AI_MODEL_HISTORICAL_FORECAST
    const originalZhipuKey = process.env.ZHIPU_API_KEY

    beforeEach(() => {
      delete process.env.AI_MODEL_HISTORICAL_FORECAST
      delete process.env.ZHIPU_API_KEY
      mockRunAgent.mockResolvedValue({ content: 'ok', tokensUsed: 1, toolsUsed: [] })
    })

    afterEach(() => {
      if (originalSpecialistModel === undefined) {
        delete process.env.AI_MODEL_HISTORICAL_FORECAST
      } else {
        process.env.AI_MODEL_HISTORICAL_FORECAST = originalSpecialistModel
      }
      if (originalZhipuKey === undefined) {
        delete process.env.ZHIPU_API_KEY
      } else {
        process.env.ZHIPU_API_KEY = originalZhipuKey
      }
    })

    it('routes a specialist to the model named in its env override', async () => {
      process.env.AI_MODEL_HISTORICAL_FORECAST = 'glm-5.2'
      process.env.ZHIPU_API_KEY = 'test-zhipu-key'

      const result = await runMultiAgent('user-123', 'Forecast cash for 6 months')


      expect(mockRunAgent.mock.calls[0][5]).toBe('glm-5.2')
      expect(result.modelName).toBe('glm-5.2')
    })

    it('leaves other specialists on the default when one is overridden', async () => {
      process.env.AI_MODEL_HISTORICAL_FORECAST = 'glm-5.2'

      const result = await runMultiAgent('user-123', 'What is my runway?')

      expect(result.specialist).toBe('financial_position')
      expect(result.modelName).toBe(DEFAULT_MODEL)
    })

    it('rejects an unconfigured specialist model before an external call', async () => {
      process.env.AI_MODEL_HISTORICAL_FORECAST = 'glm-5.2'

      await expect(
        runMultiAgent('user-123', 'Forecast cash for 6 months')
      ).rejects.toThrow('GLM-5.2 is unavailable because its provider is not configured.')
      expect(mockRunAgent).not.toHaveBeenCalled()
    })

    it('falls back to the default and warns when the override is not a known model', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
      process.env.AI_MODEL_HISTORICAL_FORECAST = 'not-a-real-model'

      const result = await runMultiAgent('user-123', 'Forecast cash for 6 months')

      expect(result.modelName).toBe(DEFAULT_MODEL)
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('not-a-real-model'))

      warn.mockRestore()
    })
  })
})

describe('company analysis specialist', () => {
  beforeEach(() => jest.clearAllMocks())

  it('gets only the company-analysis tools and the analyst prompt', async () => {
    mockRunAgent.mockResolvedValue({ content: 'Comparison', tokensUsed: 5, toolsUsed: [] })

    const result = await runMultiAgent('user-123', 'Compare Ressett with its competitor', [], [])

    expect(result.specialist).toBe('company_analysis')
    const tools = mockRunAgent.mock.calls[0][2]!
    expect(tools.map((tool) => tool.name)).toEqual([
      'list_analysed_companies',
      'analyse_company',
      'compare_companies',
    ])
    expect(mockRunAgent.mock.calls[0][4]).toContain('CIMA-qualified management accountant')
    expect(mockRunAgent.mock.calls[0][4]).toContain('never with an industry average')
  })
})

describe('routing with stored conversation history', () => {
  beforeEach(() => jest.clearAllMocks())

  it('routes a reply to a clarifying question by reading the stored question', async () => {
    mockRunAgent.mockResolvedValue({
      content: 'Which source should I use?',
      tokensUsed: 1,
      toolsUsed: [],
      toolExecutions: [],
    })
    // Past replies are stored as Responses API content blocks, not plain text.
    const storedQuestion = new AIMessage({
      content: [
        {
          type: 'text',
          text: 'What start and end timing should I use for the recurring NZD 3,000 monthly burn reduction?',
          annotations: [],
        },
      ],
    })

    const result = await runMultiAgent(
      'user-123',
      'Start October 2026, no end date.',
      [new HumanMessage('What if I cut monthly burn by NZD 3,000 from next month?'), storedQuestion],
      []
    )

    expect(result.specialist).toBe('scenario')
  })
})
