import { AGENT_SYSTEM_PROMPT } from '@/lib/chat/system-prompt'

describe('AGENT_SYSTEM_PROMPT', () => {
  it('routes current, scenario, history, and forecast questions to current tools', () => {
    expect(AGENT_SYSTEM_PROMPT).toContain('get_latest_snapshot')
    expect(AGENT_SYSTEM_PROMPT).toContain('calculate_runway')
    expect(AGENT_SYSTEM_PROMPT).toContain('model_scenario')
    expect(AGENT_SYSTEM_PROMPT).toContain('get_financial_history')
    expect(AGENT_SYSTEM_PROMPT).toContain('get_financial_forecast')
  })

  it('requires a focused clarification instead of unsupported financial claims', () => {
    expect(AGENT_SYSTEM_PROMPT).toContain('Ask one focused question instead of guessing')
    expect(AGENT_SYSTEM_PROMPT).toContain('Do not claim to calculate unsupported ratios')
    expect(AGENT_SYSTEM_PROMPT).not.toContain('financial_snapshots')
    expect(AGENT_SYSTEM_PROMPT).not.toContain('forecast_runway_trend')
  })
})
