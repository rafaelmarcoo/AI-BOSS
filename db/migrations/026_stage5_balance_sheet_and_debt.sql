-- Canonical balance-sheet classifications and explicit debt schedules for Stage 5.
-- Liquidity calculations use classified statement lines. Repayment timelines use
-- stored due dates only and never infer a schedule from a balance or maturity date.

ALTER TABLE public.financial_reporting_periods
  DROP CONSTRAINT IF EXISTS financial_reporting_periods_statement_type_check;
ALTER TABLE public.financial_reporting_periods
  ADD CONSTRAINT financial_reporting_periods_statement_type_check
  CHECK (statement_type IN ('profit_loss', 'cash_flow', 'balance_sheet'));

ALTER TABLE public.financial_statement_lines
  DROP CONSTRAINT IF EXISTS financial_statement_lines_classification_check;
ALTER TABLE public.financial_statement_lines
  ADD CONSTRAINT financial_statement_lines_classification_check
  CHECK (classification IN (
    'revenue', 'cost_of_sales', 'operating_expense', 'other_income',
    'other_expense', 'gross_profit', 'operating_profit', 'net_profit',
    'cash_inflow', 'cash_outflow', 'net_cash_flow',
    'current_asset', 'non_current_asset', 'current_liability',
    'non_current_liability', 'equity', 'total_assets',
    'total_liabilities', 'total_equity', 'other'
  ));

ALTER TABLE public.financial_statement_lines
  ADD COLUMN IF NOT EXISTS quick_ratio_treatment TEXT NOT NULL DEFAULT 'not_applicable';
ALTER TABLE public.financial_statement_lines
  DROP CONSTRAINT IF EXISTS financial_statement_lines_quick_ratio_treatment_check;
ALTER TABLE public.financial_statement_lines
  ADD CONSTRAINT financial_statement_lines_quick_ratio_treatment_check
  CHECK (quick_ratio_treatment IN ('include', 'exclude', 'unclassified', 'not_applicable'));

CREATE TABLE IF NOT EXISTS public.financial_debts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  connection_id UUID REFERENCES public.data_connections(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  sync_run_id UUID REFERENCES public.financial_sync_runs(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL,
  source_label TEXT NOT NULL,
  provider_debt_id TEXT NOT NULL,
  debt_name TEXT NOT NULL,
  lender_name TEXT,
  debt_type TEXT NOT NULL,
  status TEXT NOT NULL,
  currency TEXT NOT NULL,
  original_principal NUMERIC(18, 4),
  current_balance NUMERIC(18, 4) NOT NULL,
  annual_interest_rate NUMERIC(8, 4),
  start_date DATE,
  maturity_date DATE,
  minimum_payment NUMERIC(18, 4),
  account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT financial_debts_source_type_check
    CHECK (source_type IN ('xero', 'quickbooks', 'freshbooks', 'myob', 'document', 'manual', 'demo')),
  CONSTRAINT financial_debts_type_check
    CHECK (debt_type IN ('loan', 'credit_card', 'line_of_credit', 'lease', 'other')),
  CONSTRAINT financial_debts_status_check
    CHECK (status IN ('active', 'paid', 'refinanced', 'closed')),
  CONSTRAINT financial_debts_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT financial_debts_amounts_check CHECK (
    (original_principal IS NULL OR original_principal >= 0)
    AND current_balance >= 0
    AND (minimum_payment IS NULL OR minimum_payment >= 0)
  ),
  CONSTRAINT financial_debts_interest_rate_check
    CHECK (annual_interest_rate IS NULL OR annual_interest_rate BETWEEN 0 AND 100),
  CONSTRAINT financial_debts_dates_check
    CHECK (start_date IS NULL OR maturity_date IS NULL OR start_date <= maturity_date),
  CONSTRAINT financial_debts_provider_id_check CHECK (LENGTH(BTRIM(provider_debt_id)) > 0),
  CONSTRAINT financial_debts_name_check CHECK (LENGTH(BTRIM(debt_name)) > 0),
  UNIQUE (company_id, source_type, provider_debt_id)
);

CREATE TABLE IF NOT EXISTS public.financial_debt_repayments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  debt_id UUID NOT NULL REFERENCES public.financial_debts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  provider_repayment_id TEXT NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  principal_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
  interest_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
  total_amount NUMERIC(18, 4) NOT NULL,
  paid_at TIMESTAMP WITH TIME ZONE,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT financial_debt_repayments_status_check
    CHECK (status IN ('scheduled', 'paid', 'missed', 'cancelled')),
  CONSTRAINT financial_debt_repayments_amounts_check CHECK (
    principal_amount >= 0 AND interest_amount >= 0 AND total_amount >= 0
    AND total_amount = principal_amount + interest_amount
  ),
  CONSTRAINT financial_debt_repayments_provider_id_check
    CHECK (LENGTH(BTRIM(provider_repayment_id)) > 0),
  UNIQUE (debt_id, provider_repayment_id)
);

CREATE INDEX IF NOT EXISTS idx_financial_statement_lines_balance_sheet
  ON public.financial_statement_lines(reporting_period_id, classification, is_total);
CREATE INDEX IF NOT EXISTS idx_financial_debts_company_status
  ON public.financial_debts(company_id, status, currency);
CREATE INDEX IF NOT EXISTS idx_financial_debts_maturity
  ON public.financial_debts(company_id, maturity_date) WHERE maturity_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_financial_debt_repayments_debt_due
  ON public.financial_debt_repayments(debt_id, due_date);
CREATE INDEX IF NOT EXISTS idx_financial_debt_repayments_company_status_due
  ON public.financial_debt_repayments(company_id, status, due_date);

ALTER TABLE public.financial_debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_debt_repayments ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['financial_debts', 'financial_debt_repayments']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Users can view own %1$s" ON public.%1$I', table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Company admins can view %1$s" ON public.%1$I', table_name);
    EXECUTE format('CREATE POLICY "Company admins can view %1$s" ON public.%1$I FOR SELECT USING (company_id = public.current_company_id() AND public.current_user_company_role() = ''admin'')', table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Users can insert own %1$s" ON public.%1$I', table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Company admins can insert %1$s" ON public.%1$I', table_name);
    EXECUTE format('CREATE POLICY "Company admins can insert %1$s" ON public.%1$I FOR INSERT WITH CHECK (user_id = auth.uid() AND company_id = public.current_company_id() AND public.current_user_company_role() = ''admin'')', table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Users can update own %1$s" ON public.%1$I', table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Company admins can update %1$s" ON public.%1$I', table_name);
    EXECUTE format('CREATE POLICY "Company admins can update %1$s" ON public.%1$I FOR UPDATE USING (company_id = public.current_company_id() AND public.current_user_company_role() = ''admin'') WITH CHECK (company_id = public.current_company_id() AND public.current_user_company_role() = ''admin'')', table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Users can delete own %1$s" ON public.%1$I', table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Company admins can delete %1$s" ON public.%1$I', table_name);
    EXECUTE format('CREATE POLICY "Company admins can delete %1$s" ON public.%1$I FOR DELETE USING (company_id = public.current_company_id() AND public.current_user_company_role() = ''admin'')', table_name);
  END LOOP;
END
$$;

DROP TRIGGER IF EXISTS update_financial_debts_updated_at ON public.financial_debts;
CREATE TRIGGER update_financial_debts_updated_at
  BEFORE UPDATE ON public.financial_debts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_financial_debt_repayments_updated_at ON public.financial_debt_repayments;
CREATE TRIGGER update_financial_debt_repayments_updated_at
  BEFORE UPDATE ON public.financial_debt_repayments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
