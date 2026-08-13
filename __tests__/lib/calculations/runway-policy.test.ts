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
})
