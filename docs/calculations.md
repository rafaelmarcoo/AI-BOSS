# Calculation Logic

## Runway Calculation

AI-BOSS presents two distinct deterministic measures:

- **Primary cash runway:** `cash_runway_months = cash / monthly_burn_rate`
- **Working-capital-adjusted runway:** `working_capital_adjusted_runway_months = (cash + AR - AP) / monthly_burn_rate`

The compatibility field `runway_months` contains the primary cash-runway value.

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
| `runway_months` | Primary cash runway in months (2 decimal places) |
| `cash_runway_months` | Explicit primary cash-runway value |
| `working_capital_adjusted_runway_months` | Secondary runway after adding receivables and subtracting payables |
| `calculation_breakdown` | Inputs plus both deterministic formula strings |

---

### Why the measures are separate

Cash runway is the conservative headline because cash on hand can fund operations immediately. The adjusted measure is secondary because it assumes receivables are collected and payables are settled on the represented timing. AI-BOSS labels it explicitly instead of silently treating those assumptions as cash.

---

### Edge Cases

- `burn` must be greater than zero — division by zero is rejected with an error
- `cash`, `ar`, and `ap` must be non-negative — negative values are rejected with an error
- Primary cash runway cannot be negative because cash inputs are non-negative
- A negative **working-capital-adjusted runway** is valid and means payables exceed cash plus receivables

---

### Where results are stored

Runway calculation is shared across two consumers:

- the direct API route, which validates inputs and returns the calculated result
- the chat agent tool, which reuses the shared runway calculation operation

Historical analysis uses `financial_metric_observations`, rather than legacy
snapshot rows. Historical cash runway is calculated on read for each reporting
date where confirmed cash and burn match exactly on source and currency.
Working-capital-adjusted history additionally requires matching receivables and
payables. Derived runway points are not written back as observations. Incomplete
dates are skipped and sources or currencies are never silently combined.

## Currency Safety

The MVP supports NZD and AUD monetary observations. Values keep their recorded
currency code and are never silently converted, added, or compared across
currencies. Primary cash runway requires cash and burn to share one supported
currency, source, and reporting date. The adjusted measure applies the same
boundary to cash, accounts receivable, accounts payable, and burn.

Historical and forecast calculations exclude monetary observations whose
currency is missing or unsupported, while keeping the uploaded document
available for document retrieval. The UI and financial tools disclose these
exclusions. When history contains both NZD and AUD, AI-BOSS calculates and
displays independent currency series and forecasts in separate chart panels.
It never places both currencies into one calculation or converts between them.
Users can filter chart data by supported currency and source/statement, and can
show the latest 12, 25, 50, or all retrieved records. Each filtered series keeps
its own reporting period, source labels, trend, and latest recorded value.

## Financial Forecasting

Forecasting uses the same historical observations and supports cash, monthly
revenue, monthly expenses, burn rate, and runway for 3- or 6-month horizons.
It calculates a date-aware least-squares linear monthly trend over the selected
history range, then anchors future calendar-month projections to the latest
actual observation. Runway projections are never below zero; other metrics are
not clamped. Forecasts are trend-continuation estimates, not guarantees, and
are unavailable with fewer than two comparable dated observations. When
multiple supported currencies are present, each currency is forecast
independently.

## Scenario Comparisons

Scenario analysis uses a shared validated contract and the deterministic engine
in `lib/scenarios/`. Chat, `POST /api/scenarios/analyse`, generated UI, and the
Scenarios workspace all call the same server-side service. The model may
interpret a request and explain the result, but it does not calculate balances.

Each calculation selects exactly one owned source and one supported currency.
It never combines statements, NZD and AUD, or performs conversion. Opening
available liquidity is:

`cash + accounts receivable - accounts payable`

This assumes receivables are collected and payables are paid immediately before
Month 1. The engine then calculates two independent baselines when data exists:

- current run rate continues the latest trusted observation or manual monthly burn
- historical trend continues the existing date-aware cash slope over 3M, 6M,
  or all comparable observations

One-off and recurring cash adjustments are applied to inclusive calendar-month
buckets. Percentage changes use trusted or explicitly manual revenue, expense,
or burn values. A plain percentage is a fixed monthly step; compounding occurs
only when explicitly selected. Compounding growth stops at its end month and
retains that final level afterward. Balances may continue below zero, and
cash-out is reported as the first month ending at or below zero.

Manual baseline overrides are unverified scenario assumptions only. They are
shown in the result and are never written to `financial_metric_observations`.
Saved results remain frozen until an owner explicitly re-runs them; observation
fingerprints are used only to warn that source data changed.
