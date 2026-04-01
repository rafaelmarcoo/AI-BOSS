export interface RunwayInput {
    cash: number;
    ar: number;
    ap: number;
    burn: number;
  }

export interface RunwayBreakdown {
    cash: number;
    accountsReceivable: number;
    accountsPayable: number;
    monthlyBurnRate: number;
    netAvailableCash: number;
    formula: string;
  }

export interface RunwayResult {
    runway_months: number;
    calculation_breakdown: RunwayBreakdown;
  }


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