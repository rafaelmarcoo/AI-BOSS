-- Extends the metric keys a financial observation may use.
--
-- The original seven keys describe a cash-runway position only. CIMA-style
-- analysis needs income statement and balance sheet lines as well, so gross
-- margin, operating margin, current ratio and debt-to-equity can be calculated
-- from stored data rather than refused.
--
-- Widening only: every previously valid key stays valid and no existing row is
-- read, changed or deleted.

ALTER TABLE public.financial_metric_observations
  DROP CONSTRAINT IF EXISTS financial_metric_observations_metric_key_check;

ALTER TABLE public.financial_metric_observations
  ADD CONSTRAINT financial_metric_observations_metric_key_check
  CHECK (
    metric_key IN (
      -- Cash position (original seven)
      'cash',
      'accounts_receivable',
      'accounts_payable',
      'monthly_revenue',
      'monthly_expenses',
      'burn_rate',
      'runway_months',
      -- Income statement: with monthly_revenue these give gross and
      -- operating margin.
      'cost_of_sales',
      'operating_profit',
      -- Balance sheet: current ratio.
      'current_assets',
      'current_liabilities',
      -- Balance sheet: debt-to-equity.
      'total_debt',
      'total_equity'
    )
  );
