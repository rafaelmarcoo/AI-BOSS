-- Canonical customer and dimensional revenue models for Stage 6.
-- Revenue entries are stored once and linked to customers and typed dimensions,
-- preventing customer/product analytics from duplicating financial values.

CREATE TABLE IF NOT EXISTS public.financial_customers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
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
  UNIQUE (company_id, source_type, provider_customer_id)
);

CREATE TABLE IF NOT EXISTS public.financial_revenue_dimensions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
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
  UNIQUE (company_id, source_type, dimension_type, dimension_group, provider_dimension_id),
  UNIQUE (id, dimension_type, dimension_group)
);

CREATE TABLE IF NOT EXISTS public.financial_revenue_entries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
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
  UNIQUE (company_id, source_type, provider_revenue_id)
);

CREATE TABLE IF NOT EXISTS public.financial_revenue_entry_dimensions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  revenue_entry_id UUID NOT NULL REFERENCES public.financial_revenue_entries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
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

CREATE INDEX IF NOT EXISTS idx_financial_customers_company_name
  ON public.financial_customers(company_id, customer_name);
CREATE INDEX IF NOT EXISTS idx_financial_revenue_dimensions_company_type
  ON public.financial_revenue_dimensions(company_id, dimension_type, dimension_group);
CREATE INDEX IF NOT EXISTS idx_financial_revenue_entries_company_date
  ON public.financial_revenue_entries(company_id, revenue_date DESC);
CREATE INDEX IF NOT EXISTS idx_financial_revenue_entries_company_customer_date
  ON public.financial_revenue_entries(company_id, customer_id, revenue_date DESC);
CREATE INDEX IF NOT EXISTS idx_financial_revenue_entries_company_currency
  ON public.financial_revenue_entries(company_id, currency);
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
