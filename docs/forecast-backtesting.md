# Deterministic forecast backtesting

AI-BOSS uses a fixed-origin, date-aware linear-trend backtest as quality evidence for historical forecasts. It is intentionally a test/report utility rather than another user-facing forecast screen.

## Method

1. Keep only observations with an explicit `as_of_date` or `period_end`. Upload timestamps are not accepted as reporting dates for backtesting.
2. Partition observations by metric, source identity, and currency. NZD and AUD histories are never combined or converted.
3. Require at least three training observations and one later actual.
4. Fit the same date-aware linear slope used by the forecast logic to the first three observations.
5. Hold that training origin fixed and compare its projections with every later actual. The model is not retrained between targets.
6. Report absolute error for every target. Report percentage error only when the actual value is nonzero.

The automated fixtures cover exact/near-exact trends, a later deviation, zero actuals, insufficient history, explicit-date enforcement, and source/currency isolation. Run:

```bash
npm test -- --runInBand __tests__/lib/financial-data/forecast-backtest.test.ts
```

This evidence measures historical trend-continuation error. It does not claim that future business conditions will follow the historical trend.
