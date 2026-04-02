/** Input parameters for the runway calculation. All values are in the same currency. */
export interface RunwayInput {
  /** Current cash on hand */
  cash: number;
  /** Accounts receivable — money owed to the business */
  ar: number;
  /** Accounts payable — money the business owes */
  ap: number;
  /** Monthly cash burn rate (must be > 0) */
  burn: number;
}

/** Full breakdown of how the runway figure was derived. */
export interface RunwayBreakdown {
    cash: number;
    accountsReceivable: number;
    accountsPayable: number;
    monthlyBurnRate: number;
    /** cash + AR - AP */
    netAvailableCash: number;
    /** Human-readable formula string showing the exact numbers used */
    formula: string;
  }

/** Result returned by calculateRunway. */
export interface RunwayResult {
    /** How many months of runway remain, rounded to 2 decimal places */
    runway_months: number;
    /** Step-by-step breakdown of the calculation */
    calculation_breakdown: RunwayBreakdown;
  }


/**
 * Calculates cash runway in months using the formula:
 *   runway = (cash + AR - AP) / monthly_burn_rate
 *
 * A positive result means the business can operate for that many months.
 * A negative result means liabilities already exceed available cash.
 *
 * @throws {Error} if burn rate is zero or negative
 * @throws {Error} if cash, AR, or AP are negative
 */
export function calculateRunway(input: RunwayInput): RunwayResult {
    const { cash, ar, ap, burn } = input;
   
    if (burn <= 0) {
      throw new Error("Monthly burn rate must be greater than zero.");
    }
    if (cash < 0 || ar < 0 || ap < 0) {
      throw new Error("Cash, AR, and AP must be non-negative values.");
    }
   
    const netAvailableCash = cash + ar - ap;
    const runway_months = parseFloat((netAvailableCash / burn).toFixed(2));
   
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
    };
  }