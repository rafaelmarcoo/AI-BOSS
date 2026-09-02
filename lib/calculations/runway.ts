import { z } from 'zod'
import {
  assessRunwayPolicy,
  type RunwayPolicy,
} from '@/lib/calculations/runway-policy'

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
  workingCapitalAdjustedFormula: string
}

export interface RunwayResult {
  /** Primary, conservative cash runway. Kept as the canonical compatibility field. */
  runway_months: number
  cash_runway_months: number
  working_capital_adjusted_runway_months: number
  calculation_breakdown: RunwayBreakdown
  policy: RunwayPolicy
  working_capital_adjusted_policy: RunwayPolicy
}

export function calculateRunway(input: RunwayInput): RunwayResult {
  const { cash, ar, ap, burn } = RunwayInputSchema.parse(input)
  const netAvailableCash = cash + ar - ap
  const cashRunwayMonths = parseFloat((cash / burn).toFixed(2))
  const workingCapitalAdjustedRunwayMonths = parseFloat(
    (netAvailableCash / burn).toFixed(2)
  )

  return {
    runway_months: cashRunwayMonths,
    cash_runway_months: cashRunwayMonths,
    working_capital_adjusted_runway_months:
      workingCapitalAdjustedRunwayMonths,
    calculation_breakdown: {
      cash,
      accountsReceivable: ar,
      accountsPayable: ap,
      monthlyBurnRate: burn,
      netAvailableCash,
      formula: `${cash} / ${burn} = ${cashRunwayMonths} months`,
      workingCapitalAdjustedFormula: `(${cash} + ${ar} - ${ap}) / ${burn} = ${workingCapitalAdjustedRunwayMonths} months`,
    },
    policy: assessRunwayPolicy(cashRunwayMonths),
    working_capital_adjusted_policy: assessRunwayPolicy(
      workingCapitalAdjustedRunwayMonths
    ),
  }
}
