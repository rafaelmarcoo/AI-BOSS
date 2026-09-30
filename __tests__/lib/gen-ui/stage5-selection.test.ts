import { selectStage5FallbackSpecs } from '@/lib/gen-ui/stage5-selection'

describe('Stage 5 widget selection', () => {
  it.each([
    ['show my working capital', 'working_capital'],
    ['what is our current ratio?', 'current_ratio'],
    ['calculate the acid-test ratio', 'quick_ratio'],
    ['give me an asset breakdown', 'asset_summary'],
    ['show a liabilities overview', 'liability_summary'],
    ['show our equity position', 'equity_snapshot'],
    ['summarize our debt balance', 'debt_overview'],
    ['show the loan repayment timeline', 'debt_repayment_timeline'],
  ])('maps %s to %s', (message, expected) => {
    expect(selectStage5FallbackSpecs(message)).toContainEqual({ type: expected })
  })
})
