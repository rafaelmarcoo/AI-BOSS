-- Canonical provider-neutral read models for Stage 3 financial analysis.
-- Detailed accounting entities live here; financial_metric_observations remains
-- the source of truth for compact aggregate snapshots used by earlier stages.

CREATE TABLE IF NOT EXISTS public.financial_sync_runs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.data_connections(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  source_as_of_date DATE,
  capabilities TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  record_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT financial_sync_runs_provider_check
    CHECK (provider IN ('xero', 'quickbooks', 'freshbooks', 'myob')),
  CONSTRAINT financial_sync_runs_status_check
    CHECK (status IN ('running', 'completed', 'partial', 'failed')),
  CONSTRAINT financial_sync_runs_completion_check
    CHECK (completed_at IS NULL OR completed_at >= started_at)
);

CREATE TABLE IF NOT EXISTS public.financial_accounts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES public.data_connections(id) ON DELETE CASCADE,
  sync_run_id UUID REFERENCES public.financial_sync_runs(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL,
  source_label TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  account_code TEXT,
  account_name TEXT NOT NULL,
  account_class TEXT NOT NULL,
  account_subtype TEXT,
  canonical_category TEXT,
  cost_behavior TEXT NOT NULL DEFAULT 'unclassified',
  currency TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT financial_accounts_source_type_check
    CHECK (source_type IN ('xero', 'quickbooks', 'freshbooks', 'myob', 'document', 'manual', 'demo')),
  CONSTRAINT financial_accounts_class_check
    CHECK (account_class IN ('asset', 'liability', 'equity', 'revenue', 'expense', 'other')),
  CONSTRAINT financial_accounts_cost_behavior_check
    CHECK (cost_behavior IN ('fixed', 'variable', 'mixed', 'unclassified')),
  CONSTRAINT financial_accounts_currency_check
    CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$'),
  CONSTRAINT financial_accounts_provider_id_check
    CHECK (LENGTH(BTRIM(provider_account_id)) > 0),
  UNIQUE (user_id, source_type, provider_account_id)
);

CREATE TABLE IF NOT EXISTS public.financial_reporting_periods (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES public.data_connections(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  sync_run_id UUID REFERENCES public.financial_sync_runs(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL,
  source_label TEXT NOT NULL,
  statement_type TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  currency TEXT NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT financial_reporting_periods_source_type_check
    CHECK (source_type IN ('xero', 'quickbooks', 'freshbooks', 'myob', 'document', 'manual', 'demo')),
  CONSTRAINT financial_reporting_periods_statement_type_check
    CHECK (statement_type IN ('profit_loss', 'cash_flow')),
  CONSTRAINT financial_reporting_periods_period_check
    CHECK (period_start <= period_end),
  CONSTRAINT financial_reporting_periods_currency_check
    CHECK (currency ~ '^[A-Z]{3}$'),
  UNIQUE (user_id, source_type, statement_type, period_start, period_end, currency)
);

CREATE TABLE IF NOT EXISTS public.financial_statement_lines (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  reporting_period_id UUID NOT NULL REFERENCES public.financial_reporting_periods(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  parent_line_id UUID REFERENCES public.financial_statement_lines(id) ON DELETE SET NULL,
  line_key TEXT NOT NULL,
  label TEXT NOT NULL,
  classification TEXT NOT NULL,
  canonical_category TEXT,
  amount NUMERIC(18, 4) NOT NULL,
  cost_behavior TEXT NOT NULL DEFAULT 'unclassified',
  is_total BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT financial_statement_lines_classification_check
    CHECK (classification IN (
      'revenue', 'cost_of_sales', 'operating_expense', 'other_income',
      'other_expense', 'gross_profit', 'operating_profit', 'net_profit',
      'cash_inflow', 'cash_outflow', 'net_cash_flow', 'other'
    )),
  CONSTRAINT financial_statement_lines_cost_behavior_check
    CHECK (cost_behavior IN ('fixed', 'variable', 'mixed', 'unclassified')),
  CONSTRAINT financial_statement_lines_key_check
    CHECK (LENGTH(BTRIM(line_key)) > 0),
  UNIQUE (reporting_period_id, line_key)
);

CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES public.data_connections(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  sync_run_id UUID REFERENCES public.financial_sync_runs(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL,
  source_label TEXT NOT NULL,
  provider_transaction_id TEXT NOT NULL,
  transaction_type TEXT NOT NULL,
  transaction_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'posted',
  direction TEXT NOT NULL,
  reference TEXT,
  counterparty_name TEXT,
  description TEXT,
  currency TEXT NOT NULL,
  total_amount NUMERIC(18, 4) NOT NULL,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT financial_transactions_source_type_check
    CHECK (source_type IN ('xero', 'quickbooks', 'freshbooks', 'myob', 'document', 'manual', 'demo')),
  CONSTRAINT financial_transactions_type_check
    CHECK (transaction_type IN ('receipt', 'payment', 'purchase', 'sale', 'transfer', 'journal', 'other')),
  CONSTRAINT financial_transactions_status_check
    CHECK (status IN ('draft', 'posted', 'voided', 'deleted')),
  CONSTRAINT financial_transactions_direction_check
    CHECK (direction IN ('inflow', 'outflow', 'transfer')),
  CONSTRAINT financial_transactions_currency_check
    CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT financial_transactions_amount_check
    CHECK (total_amount >= 0),
  UNIQUE (user_id, source_type, provider_transaction_id)
);

CREATE TABLE IF NOT EXISTS public.financial_transaction_lines (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES public.financial_transactions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  line_key TEXT NOT NULL,
  description TEXT,
  canonical_category TEXT,
  amount NUMERIC(18, 4) NOT NULL,
  tax_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT financial_transaction_lines_amount_check
    CHECK (amount >= 0 AND tax_amount >= 0),
  CONSTRAINT financial_transaction_lines_key_check
    CHECK (LENGTH(BTRIM(line_key)) > 0),
  UNIQUE (transaction_id, line_key)
);

CREATE TABLE IF NOT EXISTS public.financial_budgets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES public.data_connections(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  sync_run_id UUID REFERENCES public.financial_sync_runs(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL,
  source_label TEXT NOT NULL,
  provider_budget_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  currency TEXT NOT NULL,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT financial_budgets_source_type_check
    CHECK (source_type IN ('xero', 'quickbooks', 'freshbooks', 'myob', 'document', 'manual', 'demo')),
  CONSTRAINT financial_budgets_status_check
    CHECK (status IN ('draft', 'approved', 'archived')),
  CONSTRAINT financial_budgets_period_check
    CHECK (period_start <= period_end),
  CONSTRAINT financial_budgets_currency_check
    CHECK (currency ~ '^[A-Z]{3}$'),
  UNIQUE (user_id, source_type, provider_budget_id)
);

CREATE TABLE IF NOT EXISTS public.financial_budget_lines (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  budget_id UUID NOT NULL REFERENCES public.financial_budgets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  line_key TEXT NOT NULL,
  label TEXT NOT NULL,
  kind TEXT NOT NULL,
  canonical_category TEXT,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  amount NUMERIC(18, 4) NOT NULL,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT financial_budget_lines_kind_check
    CHECK (kind IN ('revenue', 'expense', 'cash_inflow', 'cash_outflow')),
  CONSTRAINT financial_budget_lines_period_check
    CHECK (period_start <= period_end),
  CONSTRAINT financial_budget_lines_amount_check
    CHECK (amount >= 0),
  CONSTRAINT financial_budget_lines_key_check
    CHECK (LENGTH(BTRIM(line_key)) > 0),
  UNIQUE (budget_id, line_key, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_financial_sync_runs_user_started
  ON public.financial_sync_runs(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_financial_accounts_user_class
  ON public.financial_accounts(user_id, account_class);
CREATE INDEX IF NOT EXISTS idx_financial_reporting_periods_user_type_end
  ON public.financial_reporting_periods(user_id, statement_type, period_end DESC);
CREATE INDEX IF NOT EXISTS idx_financial_statement_lines_period_class
  ON public.financial_statement_lines(reporting_period_id, classification);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_user_date
  ON public.financial_transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_user_direction_date
  ON public.financial_transactions(user_id, direction, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_financial_transaction_lines_transaction
  ON public.financial_transaction_lines(transaction_id);
CREATE INDEX IF NOT EXISTS idx_financial_budgets_user_period
  ON public.financial_budgets(user_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_financial_budget_lines_budget_period
  ON public.financial_budget_lines(budget_id, period_start, period_end);

ALTER TABLE public.financial_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_reporting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_statement_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transaction_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_budget_lines ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'financial_sync_runs',
    'financial_accounts',
    'financial_reporting_periods',
    'financial_statement_lines',
    'financial_transactions',
    'financial_transaction_lines',
    'financial_budgets',
    'financial_budget_lines'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Users can view own %1$s" ON public.%1$I', table_name);
    EXECUTE format('CREATE POLICY "Users can view own %1$s" ON public.%1$I FOR SELECT USING (auth.uid() = user_id)', table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Users can insert own %1$s" ON public.%1$I', table_name);
    EXECUTE format('CREATE POLICY "Users can insert own %1$s" ON public.%1$I FOR INSERT WITH CHECK (auth.uid() = user_id)', table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Users can update own %1$s" ON public.%1$I', table_name);
    EXECUTE format('CREATE POLICY "Users can update own %1$s" ON public.%1$I FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Users can delete own %1$s" ON public.%1$I', table_name);
    EXECUTE format('CREATE POLICY "Users can delete own %1$s" ON public.%1$I FOR DELETE USING (auth.uid() = user_id)', table_name);
  END LOOP;
END
$$;

DROP TRIGGER IF EXISTS update_financial_accounts_updated_at ON public.financial_accounts;
CREATE TRIGGER update_financial_accounts_updated_at
  BEFORE UPDATE ON public.financial_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_financial_reporting_periods_updated_at ON public.financial_reporting_periods;
CREATE TRIGGER update_financial_reporting_periods_updated_at
  BEFORE UPDATE ON public.financial_reporting_periods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_financial_statement_lines_updated_at ON public.financial_statement_lines;
CREATE TRIGGER update_financial_statement_lines_updated_at
  BEFORE UPDATE ON public.financial_statement_lines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_financial_transactions_updated_at ON public.financial_transactions;
CREATE TRIGGER update_financial_transactions_updated_at
  BEFORE UPDATE ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_financial_transaction_lines_updated_at ON public.financial_transaction_lines;
CREATE TRIGGER update_financial_transaction_lines_updated_at
  BEFORE UPDATE ON public.financial_transaction_lines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_financial_budgets_updated_at ON public.financial_budgets;
CREATE TRIGGER update_financial_budgets_updated_at
  BEFORE UPDATE ON public.financial_budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_financial_budget_lines_updated_at ON public.financial_budget_lines;
CREATE TRIGGER update_financial_budget_lines_updated_at
  BEFORE UPDATE ON public.financial_budget_lines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
