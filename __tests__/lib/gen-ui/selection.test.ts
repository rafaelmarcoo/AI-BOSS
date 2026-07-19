import {
  isDataConnectionRequest,
  selectMetricKeysForMessage,
} from '@/lib/gen-ui/selection'

describe('Gen UI relevance selection', () => {
  it('selects a focused metric set for runway questions', () => {
    expect(selectMetricKeysForMessage('Show my cash and runway metrics')).toEqual([
      'runway_months',
      'cash',
      'burn_rate',
    ])
  })

  it('limits broad financial overviews to four metrics', () => {
    expect(selectMetricKeysForMessage('Show my financial overview')).toEqual([
      'runway_months',
      'cash',
      'burn_rate',
      'monthly_revenue',
    ])
  })

  it('detects data connection requests', () => {
    expect(isDataConnectionRequest('How do I connect Xero?')).toBe(true)
    expect(isDataConnectionRequest('What is my runway?')).toBe(false)
  })
})
