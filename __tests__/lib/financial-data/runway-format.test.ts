import {
  formatRunwayChange,
  formatRunwayDuration,
} from '@/lib/financial-data/runway-format'

describe('runway formatting', () => {
  it.each([
    [4.7, '4 months, 21 days'],
    [1, '1 month'],
    [0.5, '15 days'],
    [0, '0 days'],
  ])('formats %s months as %s', (value, expected) => {
    expect(formatRunwayDuration(value)).toBe(expected)
  })

  it('formats signed changes without rounding to whole months', () => {
    expect(formatRunwayChange(1.2)).toBe('+1 month, 6 days')
    expect(formatRunwayChange(-0.5)).toBe('-15 days')
  })

  it('does not display non-finite values', () => {
    expect(formatRunwayDuration(Number.POSITIVE_INFINITY)).toBe('Unavailable')
  })
})
