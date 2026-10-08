import {
  DAYS_PER_MONTH,
  formatRunway,
  monthsAndDays,
  runwayDaysFromMonths,
} from '@/lib/calculations/runway-display'

describe('runwayDaysFromMonths', () => {
  it('uses a 30-day month', () => {
    expect(DAYS_PER_MONTH).toBe(30)
    expect(runwayDaysFromMonths(3)).toBe(90)
    expect(runwayDaysFromMonths(6)).toBe(180)
  })

  it('rounds down rather than to the nearest day', () => {
    // 9.09 × 30 = 272.7: the cash does not last the whole 273rd day.
    expect(runwayDaysFromMonths(9.09)).toBe(272)
  })

  it.each([
    [4.1, 123],
    [8.2, 246],
  ])(
    'does not lose a day to floating-point error (%p months)',
    (months, days) => {
      // In JavaScript 4.1 * 30 is 122.99999999999999 and 8.2 * 30 is
      // 245.99999999999997, so a bare floor() would drop a whole day.
      expect(runwayDaysFromMonths(months)).toBe(days)
    }
  )

  it('handles zero and negative runway', () => {
    expect(runwayDaysFromMonths(0)).toBe(0)
    expect(runwayDaysFromMonths(-4)).toBe(-120)
  })
})

describe('formatRunway', () => {
  it.each([
    [9.09, '9 months 2 days (272 days)'],
    [8.04, '8 months 1 day (241 days)'],
    [1.5, '1 month 15 days (45 days)'],
    [3, '3 months (90 days)'],
    [1, '1 month (30 days)'],
    [0.5, '15 days'],
  ])('shows %p months as months and days, with total days alongside: %p', (months, expected) => {
    expect(formatRunway(months)).toBe(expected)
  })

  it('uses the singular for a single day', () => {
    // 0.05 × 30 = 1.5, which rounds down to one day.
    expect(formatRunway(0.05)).toBe('1 day')
  })

  it('gives the months-and-days part on its own for the working', () => {
    expect(monthsAndDays(241)).toBe('8 months 1 day')
    expect(monthsAndDays(272)).toBe('9 months 2 days')
    expect(monthsAndDays(15)).toBeNull()
  })

  it('shows no or negative runway in days', () => {
    expect(formatRunway(0)).toBe('0 days')
    expect(formatRunway(-4)).toBe('-120 days')
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY])(
    'reports an invalid value as unavailable rather than a number (%p)',
    (value) => {
      expect(formatRunway(value)).toBe('unavailable')
    }
  )
})
