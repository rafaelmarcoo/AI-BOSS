-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase Auth)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  company_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Financial snapshots (stores Xero data at a point in time)
CREATE TABLE IF NOT EXISTS public.financial_snapshots (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  snapshot_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Financial data
  cash_balance DECIMAL(12, 2) NOT NULL,
  accounts_receivable DECIMAL(12, 2) DEFAULT 0,
  accounts_payable DECIMAL(12, 2) DEFAULT 0,
  monthly_revenue DECIMAL(12, 2) DEFAULT 0,
  monthly_expenses DECIMAL(12, 2) DEFAULT 0,
  burn_rate DECIMAL(12, 2),
  runway_months DECIMAL(5, 2),
  
  -- Metadata
  data_source TEXT DEFAULT 'xero', -- 'xero' or 'manual'
  raw_data JSONB, -- Store full Xero response
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Policy rules (business rules and compliance)
CREATE TABLE IF NOT EXISTS public.policy_rules (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL, -- 'threshold', 'approval', 'compliance'
  rule_description TEXT,
  rule_config JSONB NOT NULL, -- Flexible config storage
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Decision log (audit trail of AI decisions)
CREATE TABLE IF NOT EXISTS public.decision_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Query info
  user_query TEXT NOT NULL,
  ai_response TEXT NOT NULL,
  
  -- What the AI did
  tools_used JSONB, -- Array of tool names and parameters
  data_accessed JSONB, -- What data was retrieved
  
  -- Calculations
  calculations JSONB, -- Any calculations performed
  
  -- Metadata
  model_used TEXT, -- 'gpt-4o', 'claude-3.5-sonnet', etc.
  tokens_used INTEGER,
  response_time_ms INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_financial_snapshots_user_id ON public.financial_snapshots(user_id);
CREATE INDEX idx_financial_snapshots_date ON public.financial_snapshots(snapshot_date DESC);
CREATE INDEX idx_policy_rules_user_id ON public.policy_rules(user_id);
CREATE INDEX idx_decision_log_user_id ON public.decision_log(user_id);
CREATE INDEX idx_decision_log_created ON public.decision_log(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decision_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see their own data

-- Users table policies
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- Financial snapshots policies
CREATE POLICY "Users can view own snapshots"
  ON public.financial_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own snapshots"
  ON public.financial_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own snapshots"
  ON public.financial_snapshots FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own snapshots"
  ON public.financial_snapshots FOR DELETE
  USING (auth.uid() = user_id);

-- Policy rules policies
CREATE POLICY "Users can view own policy rules"
  ON public.policy_rules FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own policy rules"
  ON public.policy_rules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own policy rules"
  ON public.policy_rules FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own policy rules"
  ON public.policy_rules FOR DELETE
  USING (auth.uid() = user_id);

-- Decision log policies
CREATE POLICY "Users can view own decision log"
  ON public.decision_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own decision log"
  ON public.decision_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_policy_rules_updated_at
  BEFORE UPDATE ON public.policy_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();