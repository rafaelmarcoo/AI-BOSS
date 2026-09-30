-- Canonical customer and dimensional revenue models for Stage 6.
-- Revenue entries are stored once and linked to customers and typed dimensions,
-- preventing customer/product analytics from duplicating financial values.

CREATE TABLE IF NOT EXISTS public.financial_customers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES public.data_connections(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  sync_run_id UUID REFERENCES public.financial_sync_runs(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL,
  source_label TEXT NOT NULL,
  provider_customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT financial_customers_source_type_check
    CHECK (source_type IN ('xero', 'quickbooks', 'freshbooks', 'myob', 'document', 'manual', 'demo')),
  CONSTRAINT financial_customers_status_check CHECK (status IN ('active', 'inactive')),
  CONSTRAINT financial_customers_provider_id_check CHECK (LENGTH(BTRIM(provider_customer_id)) > 0),
  CONSTRAINT financial_customers_name_check CHECK (LENGTH(BTRIM(customer_name)) > 0),
  UNIQUE (user_id, source_type, provider_customer_id)
);

CREATE TABLE IF NOT EXISTS public.financial_revenue_dimensions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES public.data_connections(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  sync_run_id UUID REFERENCES public.financial_sync_runs(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL,
  source_label TEXT NOT NULL,
  provider_dimension_id TEXT NOT NULL,
  dimension_type TEXT NOT NULL,
  dimension_group TEXT NOT NULL DEFAULT 'default',
  dimension_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT financial_revenue_dimensions_source_type_check
    CHECK (source_type IN ('xero', 'quickbooks', 'freshbooks', 'myob', 'document', 'manual', 'demo')),
  CONSTRAINT financial_revenue_dimensions_type_check
    CHECK (dimension_type IN ('product_service', 'subscription', 'department', 'business_unit', 'tracking')),
  CONSTRAINT financial_revenue_dimensions_status_check CHECK (status IN ('active', 'inactive')),
  CONSTRAINT financial_revenue_dimensions_provider_id_check CHECK (LENGTH(BTRIM(provider_dimension_id)) > 0),
  CONSTRAINT financial_revenue_dimensions_group_check CHECK (LENGTH(BTRIM(dimension_group)) > 0),
  CONSTRAINT financial_revenue_dimensions_name_check CHECK (LENGTH(BTRIM(dimension_name)) > 0),
  UNIQUE (user_id, source_type, dimension_type, dimension_group, provider_dimension_id),
  UNIQUE (id, dimension_type, dimension_group)
);

CREATE TABLE IF NOT EXISTS public.financial_revenue_entries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES public.data_connections(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  sync_run_id UUID REFERENCES public.financial_sync_runs(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL,
  source_label TEXT NOT NULL,
  provider_revenue_id TEXT NOT NULL,
  revenue_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'posted',
  currency TEXT NOT NULL,
  amount NUMERIC(18, 4) NOT NULL,
  customer_id UUID REFERENCES public.financial_customers(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.financial_invoices(id) ON DELETE SET NULL,
  transaction_id UUID REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  description TEXT,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT financial_revenue_entries_source_type_check
    CHECK (source_type IN ('xero', 'quickbooks', 'freshbooks', 'myob', 'document', 'manual', 'demo')),
  CONSTRAINT financial_revenue_entries_status_check CHECK (status IN ('draft', 'posted', 'voided', 'deleted')),
  CONSTRAINT financial_revenue_entries_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT financial_revenue_entries_provider_id_check CHECK (LENGTH(BTRIM(provider_revenue_id)) > 0),
  UNIQUE (user_id, source_type, provider_revenue_id)
);

CREATE TABLE IF NOT EXISTS public.financial_revenue_entry_dimensions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  revenue_entry_id UUID NOT NULL REFERENCES public.financial_revenue_entries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  dimension_id UUID NOT NULL,
  dimension_type TEXT NOT NULL,
  dimension_group TEXT NOT NULL DEFAULT 'default',
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT financial_revenue_entry_dimensions_type_check
    CHECK (dimension_type IN ('product_service', 'subscription', 'department', 'business_unit', 'tracking')),
  CONSTRAINT financial_revenue_entry_dimensions_group_check CHECK (LENGTH(BTRIM(dimension_group)) > 0),
  CONSTRAINT financial_revenue_entry_dimensions_dimension_fk
    FOREIGN KEY (dimension_id, dimension_type, dimension_group)
    REFERENCES public.financial_revenue_dimensions(id, dimension_type, dimension_group)
    ON DELETE CASCADE,
  UNIQUE (revenue_entry_id, dimension_type, dimension_group)
);

CREATE INDEX IF NOT EXISTS idx_financial_customers_user_name
  ON public.financial_customers(user_id, customer_name);
CREATE INDEX IF NOT EXISTS idx_financial_revenue_dimensions_user_type
  ON public.financial_revenue_dimensions(user_id, dimension_type, dimension_group);
CREATE INDEX IF NOT EXISTS idx_financial_revenue_entries_user_date
  ON public.financial_revenue_entries(user_id, revenue_date DESC);
CREATE INDEX IF NOT EXISTS idx_financial_revenue_entries_user_customer_date
  ON public.financial_revenue_entries(user_id, customer_id, revenue_date DESC);
CREATE INDEX IF NOT EXISTS idx_financial_revenue_entries_user_currency
  ON public.financial_revenue_entries(user_id, currency);
CREATE INDEX IF NOT EXISTS idx_financial_revenue_entry_dimensions_entry
  ON public.financial_revenue_entry_dimensions(revenue_entry_id);
CREATE INDEX IF NOT EXISTS idx_financial_revenue_entry_dimensions_dimension
  ON public.financial_revenue_entry_dimensions(dimension_id);

ALTER TABLE public.financial_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_revenue_dimensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_revenue_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_revenue_entry_dimensions ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'financial_customers',
    'financial_revenue_dimensions',
    'financial_revenue_entries',
    'financial_revenue_entry_dimensions'
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

DROP TRIGGER IF EXISTS update_financial_customers_updated_at ON public.financial_customers;
CREATE TRIGGER update_financial_customers_updated_at
  BEFORE UPDATE ON public.financial_customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_financial_revenue_dimensions_updated_at ON public.financial_revenue_dimensions;
CREATE TRIGGER update_financial_revenue_dimensions_updated_at
  BEFORE UPDATE ON public.financial_revenue_dimensions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_financial_revenue_entries_updated_at ON public.financial_revenue_entries;
CREATE TRIGGER update_financial_revenue_entries_updated_at
  BEFORE UPDATE ON public.financial_revenue_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_financial_revenue_entry_dimensions_updated_at ON public.financial_revenue_entry_dimensions;
CREATE TRIGGER update_financial_revenue_entry_dimensions_updated_at
  BEFORE UPDATE ON public.financial_revenue_entry_dimensions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
