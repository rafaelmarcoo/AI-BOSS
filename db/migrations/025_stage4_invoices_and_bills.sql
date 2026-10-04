-- Canonical invoice, bill, and payment entities for Stage 4.
-- Outstanding amounts and due dates are stored explicitly so ageing and
-- due-date widgets never infer detail from aggregate receivable/payable totals.

CREATE TABLE IF NOT EXISTS public.financial_invoices (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  connection_id UUID REFERENCES public.data_connections(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  sync_run_id UUID REFERENCES public.financial_sync_runs(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL,
  source_label TEXT NOT NULL,
  provider_invoice_id TEXT NOT NULL,
  invoice_kind TEXT NOT NULL,
  status TEXT NOT NULL,
  invoice_number TEXT,
  counterparty_name TEXT,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  currency TEXT NOT NULL,
  total_amount NUMERIC(18, 4) NOT NULL,
  amount_paid NUMERIC(18, 4) NOT NULL DEFAULT 0,
  outstanding_amount NUMERIC(18, 4) NOT NULL,
  fully_paid_at TIMESTAMP WITH TIME ZONE,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT financial_invoices_source_type_check
    CHECK (source_type IN ('xero', 'quickbooks', 'freshbooks', 'myob', 'document', 'manual', 'demo')),
  CONSTRAINT financial_invoices_kind_check
    CHECK (invoice_kind IN ('sales_invoice', 'supplier_bill')),
  CONSTRAINT financial_invoices_status_check
    CHECK (status IN ('draft', 'submitted', 'authorised', 'partially_paid', 'paid', 'voided', 'deleted')),
  CONSTRAINT financial_invoices_dates_check
    CHECK (issue_date <= due_date),
  CONSTRAINT financial_invoices_currency_check
    CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT financial_invoices_amounts_check
    CHECK (
      total_amount >= 0
      AND amount_paid >= 0
      AND outstanding_amount >= 0
      AND amount_paid <= total_amount
      AND outstanding_amount <= total_amount
    ),
  CONSTRAINT financial_invoices_provider_id_check
    CHECK (LENGTH(BTRIM(provider_invoice_id)) > 0),
  UNIQUE (company_id, source_type, provider_invoice_id)
);

CREATE TABLE IF NOT EXISTS public.financial_invoice_lines (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.financial_invoices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  line_key TEXT NOT NULL,
  description TEXT,
  canonical_category TEXT,
  quantity NUMERIC(18, 4),
  unit_amount NUMERIC(18, 4),
  tax_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
  line_amount NUMERIC(18, 4) NOT NULL,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT financial_invoice_lines_amounts_check
    CHECK (tax_amount >= 0 AND line_amount >= 0),
  CONSTRAINT financial_invoice_lines_key_check
    CHECK (LENGTH(BTRIM(line_key)) > 0),
  UNIQUE (invoice_id, line_key)
);

CREATE TABLE IF NOT EXISTS public.financial_invoice_payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.financial_invoices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  provider_payment_id TEXT NOT NULL,
  payment_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'posted',
  currency TEXT NOT NULL,
  amount NUMERIC(18, 4) NOT NULL,
  reference TEXT,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT financial_invoice_payments_status_check
    CHECK (status IN ('posted', 'voided', 'deleted')),
  CONSTRAINT financial_invoice_payments_currency_check
    CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT financial_invoice_payments_amount_check
    CHECK (amount >= 0),
  CONSTRAINT financial_invoice_payments_provider_id_check
    CHECK (LENGTH(BTRIM(provider_payment_id)) > 0),
  UNIQUE (invoice_id, provider_payment_id)
);

CREATE INDEX IF NOT EXISTS idx_financial_invoices_company_kind_due
  ON public.financial_invoices(company_id, invoice_kind, due_date);
CREATE INDEX IF NOT EXISTS idx_financial_invoices_company_status_due
  ON public.financial_invoices(company_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_financial_invoices_company_outstanding
  ON public.financial_invoices(company_id, outstanding_amount)
  WHERE outstanding_amount > 0;
CREATE INDEX IF NOT EXISTS idx_financial_invoice_lines_invoice
  ON public.financial_invoice_lines(invoice_id);
CREATE INDEX IF NOT EXISTS idx_financial_invoice_payments_invoice_date
  ON public.financial_invoice_payments(invoice_id, payment_date DESC);

ALTER TABLE public.financial_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_invoice_payments ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'financial_invoices',
    'financial_invoice_lines',
    'financial_invoice_payments'
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

DROP TRIGGER IF EXISTS update_financial_invoices_updated_at ON public.financial_invoices;
CREATE TRIGGER update_financial_invoices_updated_at
  BEFORE UPDATE ON public.financial_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_financial_invoice_lines_updated_at ON public.financial_invoice_lines;
CREATE TRIGGER update_financial_invoice_lines_updated_at
  BEFORE UPDATE ON public.financial_invoice_lines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_financial_invoice_payments_updated_at ON public.financial_invoice_payments;
CREATE TRIGGER update_financial_invoice_payments_updated_at
  BEFORE UPDATE ON public.financial_invoice_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
