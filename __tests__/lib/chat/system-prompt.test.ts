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

  it('requires every returned currency series to remain in the written answer', () => {
    expect(AGENT_SYSTEM_PROMPT).toContain('include every returned currency')
    expect(AGENT_SYSTEM_PROMPT).toContain('Never choose only one series')
  })

  it('forbids calculations from pending document evidence', () => {
    expect(AGENT_SYSTEM_PROMPT).toContain('review_status=Unreviewed')
    expect(AGENT_SYSTEM_PROMPT).toContain('User-confirmed')
    expect(AGENT_SYSTEM_PROMPT).not.toContain('review=pending')
    expect(AGENT_SYSTEM_PROMPT).toContain('do not perform arithmetic')
    expect(AGENT_SYSTEM_PROMPT).toContain('review and confirm the document first')
  })

  it('keeps original chunks subordinate to corrected confirmed observations', () => {
    expect(AGENT_SYSTEM_PROMPT).toContain('immutable supporting evidence')
    expect(AGENT_SYSTEM_PROMPT).toContain(
      'raw chunks can contain values the user corrected or excluded'
    )
    expect(AGENT_SYSTEM_PROMPT).toContain(
      'confirmed observation or tool value wins'
    )
  })

  it('distinguishes explicit exclusions from unreviewed candidates', () => {
    expect(AGENT_SYSTEM_PROMPT).toContain(
      'user deliberately excluded that candidate'
    )
    expect(AGENT_SYSTEM_PROMPT).toContain(
      'never describe it as pending, unreviewed, or still needing confirmation'
    )
  })

  it('forbids numerical adjusted runway from incompatible inputs', () => {
    expect(AGENT_SYSTEM_PROMPT).toContain(
      'show its symbolic formula only'
    )
    expect(AGENT_SYSTEM_PROMPT).toContain(
      'never perform a hypothetical mixed-period calculation'
    )
    expect(AGENT_SYSTEM_PROMPT).toContain(
      'never display a numerical adjusted-runway result'
    )
  })
})
