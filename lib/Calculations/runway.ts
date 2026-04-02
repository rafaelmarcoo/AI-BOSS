import { z } from 'zod'

/**
 * Zod schema for runway calculation inputs.
 *
 * Using a schema instead of a plain interface gives us runtime validation
 * and lets us derive the TypeScript type from a single source of truth.
 * The schema is exported so the API route can reuse it for request validation.
 */
export const RunwayInputSchema = z.object({
  /** Current cash on hand */
  cash: z.number().nonnegative('Cash must be non-negative.'),
  /** Accounts receivable — money owed to the business */
  ar: z.number().nonnegative('Accounts receivable must be non-negative.'),
  /** Accounts payable — money the business owes */
  ap: z.number().nonnegative('Accounts payable must be non-negative.'),
  /** Monthly cash burn rate (must be > 0) */
  burn: z.number().positive('Monthly burn rate must be greater than zero.'),
})

/** Inferred TypeScript type — derived from the schema, not declared separately. */
export type RunwayInput = z.infer<typeof RunwayInputSchema>

/** Full breakdown of how the runway figure was derived. */
export interface RunwayBreakdown {
  cash: number
  accountsReceivable: number
  accountsPayable: number
  monthlyBurnRate: number
  /** cash + AR - AP */
  netAvailableCash: number
  /** Human-readable formula string showing the exact numbers used */
  formula: string
}

/** Result returned by calculateRunway. */
export interface RunwayResult {
  /** How many months of runway remain, rounded to 2 decimal places */
  runway_months: number
  /** Step-by-step breakdown of the calculation */
  calculation_breakdown: RunwayBreakdown
}

/**
 * Calculates cash runway in months using the formula:
 *   runway = (cash + AR - AP) / monthly_burn_rate
 *
 * A positive result means the business can operate for that many months.
 * A negative result means liabilities already exceed available cash (insolvent).
 *
 * @throws {ZodError} if any input fails validation (wrong type, negative value, zero burn)
 */
export function calculateRunway(input: RunwayInput): RunwayResult {
  // parse() validates all fields at once and throws a ZodError with
  // field-level details if anything is invalid — no manual if/throw needed
  const { cash, ar, ap, burn } = RunwayInputSchema.parse(input)

  const netAvailableCash = cash + ar - ap
  const runway_months = parseFloat((netAvailableCash / burn).toFixed(2))

  return {
    runway_months,
    calculation_breakdown: {
      cash,
      accountsReceivable: ar,
      accountsPayable: ap,
      monthlyBurnRate: burn,
      netAvailableCash,
      formula: `(${cash} + ${ar} - ${ap}) / ${burn} = ${runway_months} months`,
    },
  }
}
