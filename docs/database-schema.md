# AI-BOSS Database Schema

**Database:** Supabase (PostgreSQL)  
**Created:** March 22, 2025  
**Last Updated:** May 18, 2026

---

## Overview

The database now consists of 11 main tables:
- **users** - User profiles (extends Supabase Auth)
- **conversations** - User-owned chat threads
- **conversation_messages** - Individual chat messages inside a thread
- **policy_rules** - Business rules and compliance policies
- **decision_log** - Audit trail of AI actions, tool usage, retrieval, and calculations
- **documents** - Uploaded user files stored in Supabase Storage
- **document_chunks** - Chunked document content used for semantic retrieval
- **data_connections** - Provider-neutral registry for user financial data sources
- **oauth_tokens** - Provider-neutral encrypted OAuth credential/details table
- **oauth_connection_states** - Temporary OAuth state values used for CSRF protection
- **financial_metric_observations** - Source-aware normalized financial metric values

---

## Security

**Row Level Security (RLS)** is enabled on all tables. Users can ONLY access their own data.

**Authentication:** Handled by Supabase Auth (JWT tokens)

---

## Tables

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
| title | TEXT | Optional conversation title |
| created_at | TIMESTAMP | Conversation creation time |
| updated_at | TIMESTAMP | Last message/update time |

**RLS Policies:**
- Users can view, insert, update, and delete their own conversations only

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
| file_type | TEXT | `pdf` or `csv` |
| mime_type | TEXT | Uploaded MIME type |
| storage_path | TEXT | Path in Supabase Storage |
| status | TEXT | `uploaded`, `processing`, `ready`, `failed` |
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

### 8. data_connections

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

### 9. oauth_tokens

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

### 10. oauth_connection_states

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

### 11. financial_metric_observations

Stores normalized financial metric values from Xero, uploaded documents, manual
inputs, and demo data. This table is the long-term source of truth for
source-aware metric values. Each row is one observation for one metric key from
one source/period, rather than a wide snapshot of all metrics.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| user_id | UUID (FK) | References users(id) |
| connection_id | UUID (FK) | Optional source connection from data_connections |
| document_id | UUID (FK) | Optional uploaded document source |
| metric_key | TEXT | Canonical key: `cash`, `accounts_receivable`, `accounts_payable`, `monthly_revenue`, `monthly_expenses`, `burn_rate`, or `runway_months` |
| value | NUMERIC(18,4) | Normalized metric value |
| currency | TEXT | Optional ISO currency code such as `NZD` or `AUD` |
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

## Relationships
```
users (1) ──< (many) conversations
conversations (1) ──< (many) conversation_messages
users (1) ──< (many) policy_rules
users (1) ──< (many) decision_log
users (1) ──< (many) documents
documents (1) ──< (many) document_chunks
users (1) ──< (many) data_connections
data_connections (1) ──< (one) oauth_tokens
users (1) ──< (many) oauth_connection_states
users (1) ──< (many) financial_metric_observations
data_connections (1) ──< (many) financial_metric_observations
documents (1) ──< (many) financial_metric_observations
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
- `010_add_user_type.sql` - Adds admin/employee roles used by company signup and joining

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
- **scenarios** table - Store "what-if" scenario configurations
- **forecasts** table - Store AI-generated forecasts
- **document extraction pipeline** - Promote uploaded document data into structured financial metric observations

---

**Last Updated:** May 18, 2026 by Rafael Manubay
