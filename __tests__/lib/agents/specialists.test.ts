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
      expect.stringContaining('historical review and deterministic forecasts only')
    )
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
})
