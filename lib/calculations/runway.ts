import { z } from 'zod'
import { assessRunwayPolicy, RunwayPolicy } from '@/lib/calculations/runway-policy'

export const RunwayInputSchema = z.object({
  cash: z.number().nonnegative('Cash must be non-negative.'),
  ar: z.number().nonnegative('Accounts receivable must be non-negative.'),
  ap: z.number().nonnegative('Accounts payable must be non-negative.'),
  burn: z.number().positive('Monthly burn rate must be greater than zero.'),
})

export type RunwayInput = z.infer<typeof RunwayInputSchema>

export interface RunwayBreakdown {
  cash: number
  accountsReceivable: number
  accountsPayable: number
  monthlyBurnRate: number
  netAvailableCash: number
  formula: string
}

export interface RunwayResult {
  runway_months: number
  calculation_breakdown: RunwayBreakdown
  policy: RunwayPolicy
}

export function calculateRunway(input: RunwayInput): RunwayResult {
  const { cash, ar, ap, burn } = RunwayInputSchema.parse(input)
  const netAvailableCash = cash + ar - ap
  const runwayMonths = parseFloat((netAvailableCash / burn).toFixed(2))

  return {
    runway_months: runwayMonths,
    calculation_breakdown: {
      cash,
      accountsReceivable: ar,
      accountsPayable: ap,
      monthlyBurnRate: burn,
      netAvailableCash,
      formula: `(${cash} + ${ar} - ${ap}) / ${burn} = ${runwayMonths} months`,
    },
    policy: assessRunwayPolicy(runwayMonths),
  }
}
