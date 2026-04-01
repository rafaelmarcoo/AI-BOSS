import { calculateRunway } from "@/lib/calculations/runway";

describe("calculateRunway", () => {


  describe("correct calculations", () => {
    it("calculates basic runway correctly", () => {
      const result = calculateRunway({ cash: 100000, ar: 0, ap: 0, burn: 10000 });
      expect(result.runway_months).toBe(10);
    });

    it("calculates runway with AR and AP", () => {
      const result = calculateRunway({ cash: 500000, ar: 50000, ap: 20000, burn: 30000 });
      // (500000 + 50000 - 20000) / 30000 = 17.666
      expect(result.runway_months).toBeCloseTo(17.67, 1);
    });

    it("returns zero runway when net cash is zero", () => {
      const result = calculateRunway({ cash: 0, ar: 0, ap: 0, burn: 10000 });
      expect(result.runway_months).toBe(0);
    });

    it("returns negative runway when AP exceeds cash + AR", () => {
      const result = calculateRunway({ cash: 10000, ar: 0, ap: 50000, burn: 10000 });
      // already insolvent
      expect(result.runway_months).toBeLessThan(0);
    });
  });


  describe("calculation_breakdown", () => {
    it("returns correct breakdown fields", () => {
      const result = calculateRunway({ cash: 100000, ar: 20000, ap: 5000, burn: 10000 });
      expect(result.calculation_breakdown.cash).toBe(100000);
      expect(result.calculation_breakdown.accountsReceivable).toBe(20000);
      expect(result.calculation_breakdown.accountsPayable).toBe(5000);
      expect(result.calculation_breakdown.monthlyBurnRate).toBe(10000);
      expect(result.calculation_breakdown.netAvailableCash).toBe(115000);
    });

    it("returns a formula string", () => {
      const result = calculateRunway({ cash: 100000, ar: 0, ap: 0, burn: 10000 });
      expect(typeof result.calculation_breakdown.formula).toBe("string");
      expect(result.calculation_breakdown.formula.length).toBeGreaterThan(0);
    });
  });


  describe("validation", () => {
    it("throws when burn is zero", () => {
      expect(() =>
        calculateRunway({ cash: 100000, ar: 0, ap: 0, burn: 0 })
      ).toThrow();
    });

    it("throws when burn is negative", () => {
      expect(() =>
        calculateRunway({ cash: 100000, ar: 0, ap: 0, burn: -1000 })
      ).toThrow();
    });

    it("throws when cash is negative", () => {
      expect(() =>
        calculateRunway({ cash: -1, ar: 0, ap: 0, burn: 10000 })
      ).toThrow();
    });

    it("throws when ar is negative", () => {
      expect(() =>
        calculateRunway({ cash: 100000, ar: -1, ap: 0, burn: 10000 })
      ).toThrow();
    });

    it("throws when ap is negative", () => {
      expect(() =>
        calculateRunway({ cash: 100000, ar: 0, ap: -1, burn: 10000 })
      ).toThrow();
    });
  });

});