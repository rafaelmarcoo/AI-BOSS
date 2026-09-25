import { assessRunwayPolicy } from '@/lib/calculations/runway-policy'

describe('assessRunwayPolicy', () => {
  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'does not report an invalid runway value as healthy (%p)',
    (value) => {
      const policy = assessRunwayPolicy(value)

      expect(policy.status).toBe('urgent')
      expect(policy.message).toContain('unavailable or invalid')
    }
  )

  it('states the runway in days with months alongside', () => {
    expect(assessRunwayPolicy(9.09).message).toBe(
      'Healthy: Your runway of 272 days (≈9.1 months) is above the 180-day (6-month) recommended minimum.'
    )
  })

  it.each([
    [2.99, 'urgent', 90],
    [3, 'caution', 180],
    [5.99, 'caution', 180],
    [6, 'healthy', 180],
  ] as const)(
    'keeps the same boundaries in days as in months (%p months)',
    (months, status, thresholdDays) => {
      const policy = assessRunwayPolicy(months)

      expect(policy.status).toBe(status)
      expect(policy.thresholdDays).toBe(thresholdDays)
      expect(policy.thresholdDays).toBe(policy.thresholdMonths * 30)
    }
  )

  it('names the threshold in both units when runway is urgent', () => {
    expect(assessRunwayPolicy(1.5).message).toContain(
      '45 days (≈1.5 months) is critically low, below the 90-day (3-month) threshold'
    )
  })
})
