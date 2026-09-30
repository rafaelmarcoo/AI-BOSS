# AI-BOSS Database Schema

**Database:** Supabase (PostgreSQL)  
**Created:** March 22, 2025  
**Last Updated:** September 16, 2026

---

## Overview

The database now consists of 17 main tables:
- **companies** - Company identities used as shared-data access boundaries
- **company_join_codes** - Server-only daily credentials for employee signup
- **users** - User profiles (extends Supabase Auth)
- **conversations** - User-owned chat threads
- **conversation_messages** - Individual chat messages inside a thread
- **policy_rules** - Business rules and compliance policies
- **decision_log** - Audit trail of AI actions, tool usage, retrieval, and calculations
- **documents** - Uploaded user files stored in Supabase Storage
- **document_chunks** - Chunked document content used for semantic retrieval
- **document_extraction_runs** - Versioned processing/reprocessing attempts and worksheet warnings
- **document_extraction_candidates** - Owner-protected metric candidates awaiting explicit review
- **data_connections** - Provider-neutral registry for user financial data sources
- **oauth_tokens** - Provider-neutral encrypted OAuth credential/details table
- **oauth_connection_states** - Temporary OAuth state values used for CSRF protection
- **financial_metric_observations** - Source-aware normalized financial metric values
- **scenarios** - Saved private or company-visible scenario assumptions and latest deterministic results
- **user_gen_ui_preferences** - Per-user Gen UI role, focus, detail, horizon, and history-consent settings

---

## Security

**Row Level Security (RLS)** is enabled on all tables. Users can ONLY access their own data.

**Authentication:** Handled by Supabase Auth (JWT tokens)

---

## Tables

### Companies

Canonical company records used to scope shared conversation access.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Company identifier |
| name | TEXT | Company display name |
| business_size | TEXT | Shared Gen UI size profile: `small`, `medium`, `large`, or unset |
| planning_horizon | INTEGER | Admin-controlled company planning horizon: 3, 6, or 12 months |
| created_by | UUID (FK) | User who created the company |
| created_at | TIMESTAMP | Company creation time |
| updated_at | TIMESTAMP | Last company update |

**Integrity rules:**
- Company names are unique after trimming and case normalization, so a company cannot be duplicated with different casing.
- Employee accounts can join a company only by submitting its current unexpired join code through the server-side signup route.

### Company join codes

Stores the current employee signup credential for each company. Codes rotate at
midnight UTC through Supabase Cron and are never queried directly by browser clients.

| Column | Type | Description |
|--------|------|-------------|
| company_id | UUID (PK, FK) | References companies(id); one current code per company |
| join_code | TEXT | Unique 16-character code displayed as four groups |
| expires_at | TIMESTAMP | Time the current code expires and rotates |
| created_at | TIMESTAMP | Code record creation time |
| updated_at | TIMESTAMP | Last successful rotation time |

**Security:**
- RLS is enabled with no browser-facing policies.
- `anon` and `authenticated` have no table privileges.
- Application server routes use the service role and must separately authorize admins.
- The `rotate-company-join-codes-daily` Cron job replaces every code at midnight UTC.

### 1. users

Extends Supabase Auth with additional profile information.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | References auth.users(id) |
| email | TEXT | User email (from auth) |
| full_name | TEXT | User's full name |
| company_name | TEXT | User's company name |
| user_type | TEXT | User role: `admin` or `employee` |
| created_at | TIMESTAMP | Account creation time |
| updated_at | TIMESTAMP | Last profile update |

**RLS Policies:**
- Users can view and update their own profile only

---

### 2. conversations

Stores chat threads so each user can keep a real message history.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| user_id | UUID (FK) | References users(id) |
| company_id | UUID (FK) | References companies(id); company access boundary |
| title | TEXT | Optional conversation title |
| visibility | TEXT | `private`, `company` (default), or `admins` |
| created_at | TIMESTAMP | Conversation creation time |
| updated_at | TIMESTAMP | Last message/update time |

**RLS Policies:**
- Company members can view company-visible conversations and messages
- Admins can view admins-only conversations from their company
- Private conversations are visible only to their owner
- Only conversation owners can insert, update, or delete their conversations

**Indexes:**
- `idx_conversations_user_id` on user_id
- `idx_conversations_updated_at` on updated_at (DESC)

---

### 3. conversation_messages

Stores the actual user/assistant transcript for each conversation.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| conversation_id | UUID (FK) | References conversations(id) |
| user_id | UUID (FK) | References users(id) |
| role | TEXT | `user` or `assistant` |
| content | TEXT | Message text |
| citations | JSONB | Optional RAG citations shown with the message |
| ui_payload | JSONB | Optional validated Gen UI plan rendered in the dashboard for this assistant turn |
| created_at | TIMESTAMP | Message creation time |

**RLS Policies:**
- Users can view, insert, update, and delete their own messages only

**Indexes:**
- `idx_conversation_messages_conversation_id` on conversation_id
- `idx_conversation_messages_user_id_created_at` on (user_id, created_at DESC)

---

### 4. policy_rules

Business rules and compliance policies set by the user.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| user_id | UUID (FK) | References users(id) |
| rule_name | TEXT | Human-readable name |
| rule_type | TEXT | 'threshold', 'approval', 'compliance' |
| rule_description | TEXT | What the rule does |
| rule_config | JSONB | Rule configuration (flexible) |
| is_active | BOOLEAN | Whether rule is active |
| created_at | TIMESTAMP | Rule creation time |
| updated_at | TIMESTAMP | Last rule update |

**Example rule_config:**
```json
{
  "type": "runway_threshold",
  "threshold": 6,
  "action": "warn",
  "message": "Runway below 6 months!"
}
```

**RLS Policies:**
- Users can view, insert, update, and delete their own rules only

**Indexes:**
- `idx_policy_rules_user_id` on user_id

---

### 5. decision_log

Audit trail of every AI interaction and system action. This is no longer the
source of truth for chat history. Chat messages now live in
`conversation_messages`, while `decision_log` records what happened during an
assistant turn.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| user_id | UUID (FK) | References users(id) |
| conversation_id | UUID (FK) | Optional link to a chat thread |
| assistant_message_id | UUID (FK) | Optional link to the assistant message created |
| event_type | TEXT | `chat_completion`, `document_ingestion`, `retrieval`, `tool_call`, `calculation` |
| user_query | TEXT | What the user asked |
| ai_response | TEXT | What the AI responded |
| conversation_history | JSONB | Legacy full chat snapshot kept for backward compatibility |
| tools_used | JSONB | Which tools were called |
| data_accessed | JSONB | What data was retrieved |
| calculations | JSONB | Calculations performed |
| model_used | TEXT | 'gpt-4o', 'claude-3.5-sonnet', etc. |
| tokens_used | INTEGER | API tokens consumed |
| response_time_ms | INTEGER | Response time |
| created_at | TIMESTAMP | Log entry time |

**Example tools_used:**
```json
[
  {
    "tool": "calc_runway",
    "params": {"cash": 50000, "burn": 10000},
    "result": {"runway_months": 5.0}
  }
]
```

**RLS Policies:**
- Users can view and insert their own log entries only
- Users cannot update or delete (audit trail integrity)

**Indexes:**
- `idx_decision_log_user_id` on user_id
- `idx_decision_log_created` on created_at (DESC)
- `idx_decision_log_conversation_id` on conversation_id
- `idx_decision_log_assistant_message_id` on assistant_message_id
- `idx_decision_log_event_type` on event_type

---

### 6. documents

Stores uploaded user files and their ingestion state.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| user_id | UUID (FK) | References users(id) |
| conversation_id | UUID (FK) | Optional link to the conversation that uploaded/used the file |
| file_name | TEXT | Original file name |
| file_type | TEXT | `pdf`, `csv`, or `xlsx` |
| mime_type | TEXT | Uploaded MIME type |
| storage_path | TEXT | Path in Supabase Storage |
| status | TEXT | `uploaded`, `processing`, `ready`, `failed` |
| financial_review_status | TEXT | Separate calculation-trust state: `legacy`, `not_required`, `pending`, or `confirmed` |
| document_type | TEXT | Optional business meaning like `policy`, `report`, `statement` |
| raw_text | TEXT | Extracted text used for chunking |
| metadata | JSONB | Flexible metadata such as page counts or CSV columns |
| error_message | TEXT | Processing failure details if any |
| created_at | TIMESTAMP | Upload time |
| updated_at | TIMESTAMP | Last processing/update time |

**RLS Policies:**
- Users can view, insert, update, and delete their own documents only

**Indexes:**
- `idx_documents_user_id` on user_id
- `idx_documents_conversation_id` on conversation_id
- `idx_documents_status` on status
- `idx_documents_created_at` on created_at (DESC)

**Deletion behaviour:**
- The server-only `delete_owned_document_and_derived_metrics(document_id, user_id)` function removes a user's document and every financial metric observation derived from it in one database transaction. Its RAG chunks, extraction runs, and extraction candidates are removed by document foreign-key cascades. The file itself is removed from private Supabase Storage immediately before this transaction.

---

### 7. document_chunks

Stores chunked document content and embeddings for semantic retrieval.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| document_id | UUID (FK) | References documents(id) |
| user_id | UUID (FK) | References users(id) |
| chunk_index | INTEGER | Order of the chunk within the document |
| content | TEXT | Chunk text used for retrieval |
| source_page | INTEGER | Optional source page for citations |
| metadata | JSONB | Flexible retrieval metadata |
| embedding | VECTOR(1536) | Embedding vector for semantic search |
| created_at | TIMESTAMP | Chunk creation time |

**RLS Policies:**
- Users can view, insert, update, and delete their own chunks only

**Indexes:**
- `idx_document_chunks_document_id` on document_id
- `idx_document_chunks_user_id` on user_id
- `idx_document_chunks_embedding_hnsw` on embedding using cosine distance

---

### 8. document_extraction_runs

Stores each versioned extraction or reprocessing attempt. A newly extracted run
can remain pending while observations from the previously confirmed run continue
to supply calculation truth.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Extraction run identifier |
| document_id | UUID (FK) | Source document |
| user_id | UUID (FK) | Document owner |
| status | TEXT | `processing`, `extracted`, `failed`, `confirmed`, or `superseded` |
| selected_worksheet_names | TEXT[] | XLSX worksheets selected for this attempt |
| suggested_worksheet_names | TEXT[] | Deterministically suggested XLSX worksheets |
| worksheet_metadata | JSONB | Sanitised worksheet names, visibility, dimensions, and preview metadata |
| warnings | JSONB | Run-level extraction and data-quality warnings |
| extractor_version | TEXT | Deterministic extractor version |
| error_message | TEXT | Processing failure details, if any |
| started_at | TIMESTAMP | Attempt start time |
| completed_at | TIMESTAMP | Extraction completion time |
| confirmed_at | TIMESTAMP | Successful user-confirmation time |
| superseded_at | TIMESTAMP | Time a newer confirmed run replaced this run |
| created_at | TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | Last state update |

**RLS and mutation boundary:**
- Owners can view only their own extraction runs.
- Inserts and updates are server-only so worksheet/extractor audit evidence cannot be rewritten directly by a browser client.
- At most one run per document may have `confirmed` status.

**Indexes:**
- `idx_document_extraction_runs_document_created` on (document_id, created_at DESC)
- `idx_document_extraction_runs_owner_status` on (user_id, status, created_at DESC)
- `idx_document_extraction_runs_active_confirmation` unique on document_id where status is `confirmed`

---

### 9. document_extraction_candidates

Stores one reviewable metric candidate per extraction result. `original_payload`
is retained as immutable extraction evidence; reviewed/canonical fields record the
owner's corrections and include/exclude decision.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Candidate identifier |
| extraction_run_id | UUID (FK) | Versioned extraction attempt |
| document_id | UUID (FK) | Source document |
| user_id | UUID (FK) | Document owner |
| original_payload | JSONB | Original extracted fields and values |
| reviewed_payload | JSONB | Submitted corrections and final decision |
| metric_key | TEXT | Canonical supported metric, nullable while pending |
| value | NUMERIC(18,4) | Canonical reviewed value |
| currency | TEXT | Canonical `NZD` or `AUD` for monetary metrics; `NULL` for unit-based `runway_months` |
| reporting_date | DATE | Canonical reviewed reporting date |
| confidence | NUMERIC(4,3) | Extractor confidence from 0 to 1 |
| evidence | JSONB | Source page, sheet, row, cell range, and excerpt evidence |
| warnings | JSONB | Candidate-level extraction/data-quality warnings |
| decision | TEXT | `pending`, `included`, or `excluded` |
| extractor_version | TEXT | Extractor version that created the candidate |
| reviewer_id | UUID (FK) | Owner who reviewed the candidate |
| reviewed_at | TIMESTAMP | Review time |
| created_at | TIMESTAMP | Candidate creation time |
| updated_at | TIMESTAMP | Last review update |

**RLS and confirmation boundary:**
- Owners can view only their own candidates.
- Candidate mutations are server-only to protect the original extraction evidence.
- `confirm_document_extraction(...)` verifies owner/run/candidate relationships and the complete review payload, requires valid included candidates, replaces only that document's observations, and marks the run confirmed in one transaction.
- Published observations carry `User-confirmed` trust and candidate/run audit references in `raw_data`.
- Any validation or persistence failure rolls back the complete approval transaction.

**Indexes:**
- `idx_document_extraction_candidates_run_decision` on (extraction_run_id, decision)
- `idx_document_extraction_candidates_owner_document` on (user_id, document_id)

---

### 10. data_connections

Provider-neutral registry for all financial data sources a user has connected,
uploaded, or made available. OAuth credential rows link back to this table.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| user_id | UUID (FK) | References users(id) |
| provider | TEXT | `xero`, `quickbooks`, `freshbooks`, `myob`, `csv`, `pdf`, `manual`, or `demo` |
| status | TEXT | `connected`, `disconnected`, `available`, or `error` |
| display_name | TEXT | User-facing source name |
| source_label | TEXT | Short provider/source label |
| last_synced_at | TIMESTAMP | Last successful source sync |
| connected_at | TIMESTAMP | When the source connected |
| disconnected_at | TIMESTAMP | When the source disconnected |
| error_message | TEXT | Latest connection/source error if any |
| metadata | JSONB | Provider-neutral source metadata |
| created_at | TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | Last source state update |

**RLS Policies:**
- Users can view, insert, update, and delete their own data connections only

**Indexes:**
- `idx_data_connections_user_id` on user_id
- `idx_data_connections_provider` on provider
- `idx_data_connections_status` on status

---

### 11. oauth_tokens

Stores provider-neutral tenant details and OAuth credentials for accounting
providers. This table links to `data_connections`, which is the source of truth
for user-visible connection state. Tokens are encrypted with AES-GCM before
storage and are only decrypted server-side when calling or revoking a provider.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| connection_id | UUID (FK) | References data_connections(id), unique |
| user_id | UUID (FK) | References users(id) |
| provider | TEXT | `xero`, `quickbooks`, `freshbooks`, or `myob` |
| tenant_id | TEXT | Provider tenant/company/organisation ID |
| tenant_name | TEXT | Provider tenant/company/organisation display name |
| access_token_enc | TEXT | Encrypted provider access token |
| refresh_token_enc | TEXT | Encrypted provider refresh token |
| expires_at | TIMESTAMP | Access token expiry |
| connected_at | TIMESTAMP | Time the user connected the provider |
| updated_at | TIMESTAMP | Last token refresh or connection update |

**RLS Policies:**
- Users can view, insert, update, and delete their own OAuth tokens only

**Indexes:**
- `idx_oauth_tokens_user_provider` on (user_id, provider)
- `idx_oauth_tokens_connection_id` on connection_id

---

### 12. oauth_connection_states

Stores short-lived state values during OAuth redirect flows. A state row is
created when the user starts connecting an OAuth provider and deleted after
callback validation.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| user_id | UUID (FK) | References users(id), unique per user |
| provider | TEXT | OAuth provider such as `xero`, `quickbooks`, `freshbooks`, or `myob` |
| state | TEXT | Random OAuth state value used for CSRF protection |
| redirect_path | TEXT | Path to return to after OAuth completes |
| created_at | TIMESTAMP | State creation time |

**RLS Policies:**
- Users can view, insert, update, and delete their own OAuth state only

**Indexes:**
- `idx_oauth_connection_states_user_provider` on (user_id, provider)
- `idx_oauth_connection_states_created_at` on created_at (DESC)

---

### 13. financial_metric_observations

Stores normalized financial metric values from Xero, uploaded documents, manual
inputs, and demo data. This table is the long-term source of truth for
source-aware metric values. Each row is one observation for one metric key from
one source/period, rather than a wide snapshot of all metrics.

Existing document-derived rows remain calculation truth after migration and are
represented by their document's `legacy` review state. New document-derived rows
are published only from included candidates through `confirm_document_extraction`.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| user_id | UUID (FK) | References users(id) |
| connection_id | UUID (FK) | Optional source connection from data_connections |
| document_id | UUID (FK) | Optional uploaded document source |
| metric_key | TEXT | Canonical key: `cash`, `accounts_receivable`, `accounts_payable`, `monthly_revenue`, `monthly_expenses`, `burn_rate`, or `runway_months` |
| value | NUMERIC(18,4) | Normalized metric value |
| currency | TEXT | `NZD` or `AUD` for monetary metrics; `NULL` for unit-based `runway_months` |
| period_start | DATE | Optional period start for period-based metrics |
| period_end | DATE | Optional period end for period-based metrics |
| as_of_date | DATE | Optional point-in-time date for balance metrics |
| source_type | TEXT | `xero`, `quickbooks`, `freshbooks`, `myob`, `document`, `manual`, or `demo` |
| source_label | TEXT | User-facing source label |
| confidence | NUMERIC(4,3) | Confidence score from 0 to 1 |
| evidence | JSONB | Evidence reference such as document page, row range, chunk, URL, or excerpt |
| raw_data | JSONB | Source-specific raw extraction/normalization payload |
| created_at | TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | Last update time |

**RLS Policies:**
- Users can view, insert, update, and delete their own metric observations only

**Indexes:**
- `idx_financial_metric_observations_user_metric_updated` on (user_id, metric_key, updated_at DESC)
- `idx_financial_metric_observations_user_source` on (user_id, source_type)
- `idx_financial_metric_observations_connection_id` on connection_id
- `idx_financial_metric_observations_document_id` on document_id
- `idx_financial_metric_observations_as_of_date` on as_of_date (DESC)

---

### 14. Stage 3 canonical financial read models

Detailed accounting data is normalized separately from
`financial_metric_observations`. Provider payloads remain available in
`raw_data` for audit, but application calculations use the canonical columns.
Every table is user-owned, protected by RLS, and retains source connection and
sync-run provenance where applicable.

#### financial_sync_runs

Tracks each detailed accounting import, its provider capabilities, source date,
record counts, completion state, and any error. This makes partial provider
support explicit and keeps sync failures from masquerading as zero values.

#### financial_accounts

Stores the canonical chart of accounts. Account class and category drive
profit and expense calculations. `cost_behavior` is one of `fixed`, `variable`,
`mixed`, or `unclassified`; break-even widgets may not treat unclassified costs
as fixed or variable.

#### financial_reporting_periods and financial_statement_lines

Stores distinct `profit_loss` and `cash_flow` reports by reporting period and
currency. Repeated syncs upsert the same period instead of creating another
month. Statement lines identify revenue, cost of sales, operating expenses,
profit totals, cash inflows, cash outflows, and net cash flow.

Component revenue and cost lines use positive magnitudes. Derived profit and net
cash-flow totals may be negative. This avoids interpreting revenue minus
expenses as cash flow.

#### financial_transactions and financial_transaction_lines

Stores posted receipts, payments, purchases, sales, transfers, journals, and
other canonical transactions. Provider transaction IDs prevent repeated syncs
from duplicating transactions. Lines retain account/category links for expense
breakdowns and largest-expense analysis.

#### financial_budgets and financial_budget_lines

Stores draft, approved, or archived budgets and their dated revenue, expense,
cash-inflow, and cash-outflow lines. Actual-versus-budget calculations align
lines by currency, category/account, and overlapping reporting period.

**RLS Policies:**
- Users can view, insert, update, and delete only rows whose `user_id` matches `auth.uid()`
- Server-side provider synchronization still verifies the authenticated owner before using the administrative client

**Deduplication:**
- Accounts: `(user_id, source_type, provider_account_id)`
- Reporting periods: `(user_id, source_type, statement_type, period_start, period_end, currency)`
- Statement lines: `(reporting_period_id, line_key)`
- Transactions: `(user_id, source_type, provider_transaction_id)`
- Transaction lines: `(transaction_id, line_key)`
- Budgets: `(user_id, source_type, provider_budget_id)`
- Budget lines: `(budget_id, line_key, period_start, period_end)`

---

### 15. Stage 4 invoices, bills, and payments

Stage 4 stores invoice-level due dates and outstanding balances separately from
aggregate accounts receivable and accounts payable. Widgets never reconstruct
invoice ageing from aggregate totals.

#### financial_invoices

Stores both customer invoices (`sales_invoice`) and supplier bills
(`supplier_bill`). Canonical status, issue date, due date, currency, total,
paid amount, and outstanding amount are explicit columns. Provider payloads are
retained in `raw_data` for audit and future provider-specific troubleshooting.

Only invoices with a positive `outstanding_amount` and a non-terminal status
are used for overdue, ageing, expected-payment, and bills-due calculations.
Calculations group records by source and currency; no implicit currency
conversion occurs.

#### financial_invoice_lines

Stores canonical invoice or bill line items, including optional chart-of-account
links, descriptions, categories, quantity, unit amount, tax, and line amount.
Stage 4 widgets primarily use invoice headers, while these lines preserve the
normalized detail required by later customer and product analytics.

#### financial_invoice_payments

Stores posted, voided, or deleted payments linked to an invoice or bill.
Provider payment IDs make repeated synchronization idempotent. The header-level
`amount_paid` and `outstanding_amount` remain the source of truth for current
open balances.

**RLS Policies:**
- Users can view, insert, update, and delete only rows whose `user_id` matches `auth.uid()`
- Provider synchronization verifies the authenticated owner before administrative writes

**Deduplication:**
- Invoices: `(user_id, source_type, provider_invoice_id)`
- Invoice lines: `(invoice_id, line_key)`
- Payments: `(invoice_id, provider_payment_id)`

**Ageing boundaries:**
- Age is measured from the stored due date to the displayed as-of date
- Buckets are 0–30, 31–60, 61–90, and 90+ days overdue
- Not-yet-due invoices are excluded from overdue ageing and handled by Expected Payments

---

### 16. Stage 5 balance sheet and debt

Balance-sheet reports reuse `financial_reporting_periods` and
`financial_statement_lines` with `statement_type = balance_sheet`. Lines are
classified as current/non-current assets and liabilities, equity, or explicit
statement totals. Component lines and total lines are stored separately so
calculations do not double count them.

`quick_ratio_treatment` records whether each current-asset component is
included, excluded, or still unclassified for the quick ratio. The application
does not calculate that ratio while any component remains unclassified.

#### financial_debts and financial_debt_repayments

`financial_debts` stores lender, balance, currency, interest rate, and optional
start/maturity details for a specific debt. `financial_debt_repayments` stores
provider- or user-supplied repayment dates and amounts. A balance or maturity
date is never expanded into an invented repayment schedule.

Debt overview calculations group records by source and currency. Repayment
timelines use only stored repayment rows with a scheduled status, preserving
the distinction between contractual dates and estimates.

**RLS Policies:**
- Users can view, insert, update, and delete only their own debt and repayment rows
- Provider synchronization verifies ownership before administrative writes

**Deduplication:**
- Debts: `(user_id, source_type, provider_debt_id)`
- Repayments: `(debt_id, provider_repayment_id)`

---

### 14. scenarios

Stores reusable what-if drafts and the latest explicitly calculated result. The
application validates both JSON payloads. A baseline fingerprint lets AI-BOSS
warn when source observations changed instead of silently rewriting an earlier
decision analysis.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Saved scenario identifier |
| user_id | UUID (FK) | Owner; only the owner may edit or delete |
| company_id | UUID (FK) | Company access boundary for explicitly shared scenarios |
| name | TEXT | Required name, 1–80 trimmed characters |
| description | TEXT | Optional description, maximum 500 characters |
| status | TEXT | `draft` or `calculated` |
| visibility | TEXT | `private` or `company`; drafts must remain private |
| input_payload | JSONB | Structured scenario assumptions |
| result_payload | JSONB | Latest deterministic result snapshot, or null for a draft |
| baseline_fingerprint | JSONB | Observation IDs and update timestamps used by the latest result |
| calculated_at | TIMESTAMP | Time of the latest successful calculation |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Last saved change |

**RLS Policies:**
- Owners can view, insert, update, and delete their own scenarios
- Company members can view company-visible calculated scenarios
- Company members cannot edit shared originals; duplication creates a new private owner copy
- Incomplete drafts cannot be company-visible

**Indexes:**
- `idx_scenarios_owner_updated` on (user_id, updated_at DESC)
- `idx_scenarios_company_visibility_updated` on (company_id, visibility, updated_at DESC)

---

### 13. user_gen_ui_preferences

Stores explicit, user-controlled signals that help AI-BOSS choose useful Gen UI
widgets. Business size is stored on `companies` because it is shared; these
settings remain personal to each user. Current-question relevance and available
data still take priority over these preferences.

| Column | Type | Description |
|--------|------|-------------|
| user_id | UUID (PK/FK) | User whose preferences these are |
| decision_role | TEXT | Admin roles: `owner`, `finance`, `manager`; worker roles: `accountant`, `operations`, `team_member` |
| priority_topics | TEXT[] | Up to three explicit focus areas |
| detail_level | TEXT | `quick`, `balanced`, or `detailed` |
| learn_from_history | BOOLEAN | Explicit opt-in for future user-owned chat-theme learning |
| created_at | TIMESTAMP | Preference creation time |
| updated_at | TIMESTAMP | Last preference update |

**RLS Policies:**
- Users can view, insert, and update only their own preferences
- Company business size is changed server-side only after verifying the user is a company admin

---

## Relationships
```
users (1) ──< (many) conversations
companies (1) ──< (many) conversations
companies (1) ── (one) company_join_codes
conversations (1) ──< (many) conversation_messages
users (1) ──< (many) policy_rules
users (1) ──< (many) decision_log
users (1) ──< (many) documents
documents (1) ──< (many) document_chunks
documents (1) ──< (many) document_extraction_runs
document_extraction_runs (1) ──< (many) document_extraction_candidates
users (1) ──< (many) data_connections
data_connections (1) ──< (one) oauth_tokens
users (1) ──< (many) oauth_connection_states
users (1) ──< (many) financial_metric_observations
data_connections (1) ──< (many) financial_metric_observations
documents (1) ──< (many) financial_metric_observations
users (1) ──< (many) financial_sync_runs
data_connections (1) ──< (many) financial_sync_runs
users (1) ──< (many) financial_accounts
users (1) ──< (many) financial_reporting_periods
financial_reporting_periods (1) ──< (many) financial_statement_lines
users (1) ──< (many) financial_transactions
financial_transactions (1) ──< (many) financial_transaction_lines
users (1) ──< (many) financial_budgets
financial_budgets (1) ──< (many) financial_budget_lines
users (1) ──< (many) financial_invoices
financial_invoices (1) ──< (many) financial_invoice_lines
financial_invoices (1) ──< (many) financial_invoice_payments
users (1) ──< (many) financial_debts
financial_debts (1) ──< (many) financial_debt_repayments
users (1) ──< (many) scenarios
companies (1) ──< (many) scenarios
users (1) ──< (one) user_gen_ui_preferences
```

---

## Migrations

All schema changes are tracked in `db/migrations/`:
- `001_initial_schema.sql` - Initial database setup
- `002_add_conversation_history_to_decision_log.sql` - Adds a dedicated JSONB field for chat transcripts
- `003_chat_rag_schema_foundation.sql` - Adds chat history tables, document tables, and vector-ready chunk storage
- `004_xero_oauth.sql` - Adds encrypted Xero OAuth connections and temporary OAuth states
- `005_data_connections_foundation.sql` - Adds provider-neutral data connections, generic OAuth states, links Xero credentials, and drops the old Xero-only OAuth state table
- `006_financial_metric_observations.sql` - Adds source-aware normalized financial metric observation storage
- `007_drop_financial_snapshots.sql` - Drops the legacy financial snapshots table
- `008_accounting_oauth_tokens.sql` - Adds provider-neutral OAuth tokens and drops the Xero-specific credential table
- `009_conversation_message_ui_payload.sql` - Adds validated Gen UI payloads to assistant messages
- `010_add_user_type.sql` - Adds admin/employee roles used by company signup and joining; existing company accounts are backfilled as admins
- `011_company_chat_visibility.sql` - Adds company-scoped conversation history and message read access
- `012_conversation_visibility_modes.sql` - Adds private, company, and admins-only conversation visibility
- `013_delete_document_and_derived_metrics.sql` - Adds atomic owner-only cleanup of a document and its document-derived financial observations
- `014_saved_scenarios.sql` - Adds private drafts, company-visible calculated scenarios, result snapshots, and stale-data fingerprints
- `015_document_extraction_review.sql` - Adds XLSX document support, separate financial review state, versioned extraction runs/candidates, owner-protected review evidence, and transactional publication of user-confirmed observations
- `016_runway_currency_unit.sql` - Enforces currency-free `runway_months` candidates during transactional confirmation while retaining source currency in original audit evidence
- `017_daily_company_join_codes.sql` - Adds protected stored company join codes and a daily UTC rotation job
- `018_gen_ui_personalization.sql` - Adds shared company size and per-user Gen UI personalization preferences
- `019_company_gen_ui_controls.sql` - Moves planning horizon to the admin-controlled company profile and adds worker-specific roles
- `020_stage3_financial_read_models.sql` - Adds canonical accounts, financial statements, transactions, budgets, sync provenance, RLS, and provider-safe deduplication for Stage 3 widgets
- `021_stage4_invoices_and_bills.sql` - Adds canonical sales invoices, supplier bills, line items, payments, due-date indexes, RLS, and provider-safe deduplication for Stage 4 widgets
- `022_stage5_balance_sheet_and_debt.sql` - Adds balance-sheet classifications, explicit quick-ratio treatment, debts, and stored repayment schedules

---

## Access Patterns

### Common Queries

**Get latest available value for each metric key:**
```sql
SELECT DISTINCT ON (metric_key) *
FROM financial_metric_observations
WHERE user_id = $1
ORDER BY metric_key, updated_at DESC;
```

**Get user's active policy rules:**
```sql
SELECT * FROM policy_rules
WHERE user_id = $1 AND is_active = true;
```

**Get recent AI decisions:**
```sql
SELECT * FROM decision_log
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT 20;
```

**Get recent conversations:**
```sql
SELECT * FROM conversations
WHERE user_id = $1
ORDER BY updated_at DESC
LIMIT 20;
```

**Get messages for a conversation:**
```sql
SELECT * FROM conversation_messages
WHERE conversation_id = $1
ORDER BY created_at ASC;
```

---

## Future Enhancements

Planned for Sprint 2+:
- **forecasts** table - Store AI-generated forecasts
- **document extraction pipeline** - Promote uploaded document data into structured financial metric observations

---

**Last Updated:** September 16, 2026 by Rafael Manubay
