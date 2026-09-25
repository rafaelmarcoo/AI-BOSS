-- Companies analysed from their published annual statements, such as the CIMA
-- case-study companies (Trimayr, Pallo & Troo, Ressett, Fixxupp).
--
-- These are kept apart from financial_metric_observations on purpose. Every
-- existing read path (runway, snapshot, history, forecast, scenarios) treats
-- that table as the user's OWN business, measured monthly in NZD or AUD. An
-- analysed company is someone else's business, reported annually, often in a
-- fictional currency (D$, L$). Separate tables mean its figures can never reach
-- the user's runway, and its annual statement lines never get mislabelled as
-- monthly metrics.
--
-- A company with no user_id is shared reference data (the case studies): every
-- signed-in user can read it and only the server can change it. A company with
-- a user_id belongs to that user alone.

CREATE TABLE IF NOT EXISTS public.analysed_companies (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  industry TEXT,
  -- Companies in the same peer group compete with each other, so "compare
  -- Trimayr with its competitor" can be answered without naming the rival.
  peer_group TEXT,
  currency TEXT NOT NULL,
  amounts_in TEXT DEFAULT 'millions' NOT NULL,
  description TEXT,
  source TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT analysed_companies_name_check
    CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  -- ISO codes such as NZD, or case-study currencies such as D$ and L$.
  CONSTRAINT analysed_companies_currency_check
    CHECK (currency ~ '^[A-Z]{1,3}\$?$'),
  CONSTRAINT analysed_companies_amounts_in_check
    CHECK (amounts_in IN ('units', 'thousands', 'millions'))
);

-- One company per name per owner, ignoring case and surrounding spaces. Shared
-- companies (no owner) get their own index because NULLs never collide in a
-- unique index.
CREATE UNIQUE INDEX IF NOT EXISTS idx_analysed_companies_user_name
  ON public.analysed_companies(user_id, lower(btrim(name)))
  WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_analysed_companies_shared_name
  ON public.analysed_companies(lower(btrim(name)))
  WHERE user_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_analysed_companies_peer_group
  ON public.analysed_companies(peer_group);

CREATE TABLE IF NOT EXISTS public.company_statement_lines (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.analysed_companies(id) ON DELETE CASCADE NOT NULL,
  fiscal_year_end DATE NOT NULL,
  line_key TEXT NOT NULL,
  -- Revenue stream for segment lines, such as "Franchise royalties". Empty
  -- string rather than NULL so the uniqueness rule below applies to every row.
  segment TEXT DEFAULT '' NOT NULL,
  -- Costs are stored as positive amounts; the line key says it is a cost.
  value NUMERIC(18, 4) NOT NULL,
  source_page INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT company_statement_lines_line_key_check
    CHECK (
      line_key IN (
        'revenue',
        'cost_of_sales',
        'gross_profit',
        'marketing_expenses',
        'administrative_expenses',
        'total_operating_costs',
        'operating_profit',
        'finance_costs',
        'profit_before_tax',
        'tax_expense',
        'profit_for_year',
        'dividends',
        'segment_revenue',
        'segment_direct_costs',
        'intangible_assets',
        'property_plant_equipment',
        'non_current_assets',
        'inventory',
        'trade_receivables',
        'cash',
        'current_assets',
        'total_assets',
        'share_capital',
        'retained_earnings',
        'total_equity',
        'non_current_borrowings',
        'trade_payables',
        'tax_payable',
        'current_liabilities'
      )
    ),
  -- Only the two segment lines carry a revenue stream name; every other line
  -- describes the whole company.
  CONSTRAINT company_statement_lines_segment_check
    CHECK (
      (line_key IN ('segment_revenue', 'segment_direct_costs') AND segment <> '')
      OR (line_key NOT IN ('segment_revenue', 'segment_direct_costs') AND segment = '')
    ),
  CONSTRAINT company_statement_lines_unique
    UNIQUE (company_id, fiscal_year_end, line_key, segment)
);

CREATE INDEX IF NOT EXISTS idx_company_statement_lines_company_year
  ON public.company_statement_lines(company_id, fiscal_year_end DESC);

ALTER TABLE public.analysed_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_statement_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view shared and own analysed companies"
  ON public.analysed_companies FOR SELECT
  USING (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "Users can insert own analysed companies"
  ON public.analysed_companies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own analysed companies"
  ON public.analysed_companies FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own analysed companies"
  ON public.analysed_companies FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view statement lines of visible companies"
  ON public.company_statement_lines FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.analysed_companies company
      WHERE company.id = company_statement_lines.company_id
        AND (company.user_id IS NULL OR company.user_id = auth.uid())
    )
  );

CREATE POLICY "Users can change statement lines of own companies"
  ON public.company_statement_lines FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.analysed_companies company
      WHERE company.id = company_statement_lines.company_id
        AND company.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.analysed_companies company
      WHERE company.id = company_statement_lines.company_id
        AND company.user_id = auth.uid()
    )
  );

CREATE TRIGGER update_analysed_companies_updated_at
  BEFORE UPDATE ON public.analysed_companies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_company_statement_lines_updated_at
  BEFORE UPDATE ON public.company_statement_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
