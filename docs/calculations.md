# Calculation Logic

## Runway Calculation

**Formula:** `runway_months = (cash + AR - AP) / monthly_burn_rate`

**Implemented in:** `lib/calculations/runway.ts` — `calculateRunway()`
**Persistence service:** `lib/services/runway-service.ts`
**Agent tool wrapper:** `lib/tools/financial/calculate-runway.ts`
**API endpoint:** `POST /api/calculate/runway`

---

### Inputs

| Parameter | Description |
|-----------|-------------|
| `cash` | Current cash on hand |
| `ar` | Accounts receivable — money owed to the business |
| `ap` | Accounts payable — money the business owes |
| `burn` | Monthly cash burn rate |

### Output

| Field | Description |
|-------|-------------|
| `runway_months` | How many months of runway remain (2 decimal places) |
| `calculation_breakdown` | Step-by-step breakdown including each input and the formula string |

---

### Why AR and AP are included

Cash alone understates available liquidity. AR is money already earned that will convert to cash shortly. AP is an obligation that will reduce cash shortly. Including both gives a more accurate picture of net available cash before dividing by burn rate.

---

### Edge Cases

- `burn` must be greater than zero — division by zero is rejected with an error
- `cash`, `ar`, and `ap` must be non-negative — negative values are rejected with an error
- A **negative** `runway_months` result is valid — it means liabilities already exceed available cash (business is already insolvent)

---

### Where results are stored

Runway calculation is shared across two consumers:

- the direct API route, which validates inputs and returns the calculated result
- the chat agent tool, which reuses the shared runway calculation operation

Historical analysis uses `financial_metric_observations`, rather than legacy
snapshot rows. It supports cash, monthly revenue, monthly expenses, burn rate,
and runway observations. The analysis is deterministic: it prioritises financial
reporting dates, preserves source labels, warns when sources are mixed, and does
not compare values across different currencies.

## Financial Forecasting

Forecasting uses the same historical observations and supports cash, monthly
revenue, monthly expenses, burn rate, and runway for 3- or 6-month horizons.
It calculates a date-aware least-squares linear monthly trend over the selected
history range, then anchors future calendar-month projections to the latest
actual observation. Runway projections are never below zero; other metrics are
not clamped. Forecasts are trend-continuation estimates, not guarantees, and
are unavailable with fewer than two comparable dated observations or multiple
non-null currencies.
