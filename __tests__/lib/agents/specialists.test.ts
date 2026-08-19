import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages'
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
})
