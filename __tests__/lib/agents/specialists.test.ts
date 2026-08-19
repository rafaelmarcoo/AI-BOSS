import { SystemMessage } from '@langchain/core/messages'
import { runAgent } from '@/lib/ai/agent'
import { runMultiAgent } from '@/lib/agents/specialists'

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

const mockRunAgent = jest.mocked(runAgent)

describe('runMultiAgent', () => {
  beforeEach(() => jest.clearAllMocks())

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
      'gpt-4o-mini'
    )
    expect(result.modelName).toBe('gpt-4o-mini')
    const tools = mockRunAgent.mock.calls[0][2]!
    expect(tools.map((tool) => tool.name)).not.toContain('model_scenario')
    expect(tools.map((tool) => tool.name)).not.toContain('calculate_runway')
    expect(mockRunAgent.mock.calls[0][4]).toContain('preserve both in the final answer')
  })

  it('uses only the scenario tool for a percentage burn scenario', async () => {
    mockRunAgent.mockResolvedValue({ content: 'Scenario result', tokensUsed: 8, toolsUsed: [] })

    const result = await runMultiAgent('user-123', 'Cut our burn by 20%')

    expect(result.specialist).toBe('scenario')
    const tools = mockRunAgent.mock.calls[0][2]!
    expect(tools.map((tool) => tool.name)).toEqual(['model_scenario'])
    expect(mockRunAgent.mock.calls[0][4]).toContain('Never calculate the dollar amount yourself')
  })

  it('rejects ambiguous and unsupported percentage scenarios without an LLM call', async () => {
    const ambiguous = await runMultiAgent('user-123', 'Cut it by 20%')
    const revenue = await runMultiAgent('user-123', 'What if revenue grows by 20%?')

    expect(ambiguous.content).toContain('specify monthly burn')
    expect(revenue.content).toContain('Revenue percentage scenarios are not supported')
    expect(mockRunAgent).not.toHaveBeenCalled()
  })

  describe('per-specialist model selection', () => {
    const originalEnv = process.env

    beforeEach(() => {
      process.env = { ...originalEnv }
      mockRunAgent.mockResolvedValue({ content: 'ok', tokensUsed: 1, toolsUsed: [] })
    })

    afterEach(() => {
      process.env = originalEnv
    })

    it('routes a specialist to the model named in its env override', async () => {
      process.env.AI_MODEL_HISTORICAL_FORECAST = 'glm-5.2'

      const result = await runMultiAgent('user-123', 'Forecast cash for 6 months')


      expect(mockRunAgent.mock.calls[0][5]).toBe('glm-5.2')
      expect(result.modelName).toBe('glm-5.2')
    })

    it('leaves other specialists on the default when one is overridden', async () => {
      process.env.AI_MODEL_HISTORICAL_FORECAST = 'glm-5.2'

      const result = await runMultiAgent('user-123', 'What is my runway?')

      expect(result.specialist).toBe('financial_position')
      expect(result.modelName).toBe('gpt-4o-mini')
    })

    it('falls back to the default and warns when the override is not a known model', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
      process.env.AI_MODEL_HISTORICAL_FORECAST = 'not-a-real-model'

      const result = await runMultiAgent('user-123', 'Forecast cash for 6 months')

      expect(result.modelName).toBe('gpt-4o-mini')
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('not-a-real-model'))

      warn.mockRestore()
    })
  })
})
