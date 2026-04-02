# AI-BOSS Database Schema

**Database:** Supabase (PostgreSQL)  
**Created:** March 22, 2025  
**Last Updated:** March 31, 2026

---

## Overview

The database now consists of 8 main tables:
- **users** - User profiles (extends Supabase Auth)
- **conversations** - User-owned chat threads
- **conversation_messages** - Individual chat messages inside a thread
- **financial_snapshots** - Point-in-time financial data from Xero
- **policy_rules** - Business rules and compliance policies
- **decision_log** - Audit trail of AI actions, tool usage, retrieval, and calculations
- **documents** - Uploaded user files stored in Supabase Storage
- **document_chunks** - Chunked document content used for semantic retrieval

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
| created_at | TIMESTAMP | Message creation time |

**RLS Policies:**
- Users can view, insert, update, and delete their own messages only

**Indexes:**
- `idx_conversation_messages_conversation_id` on conversation_id
- `idx_conversation_messages_user_id_created_at` on (user_id, created_at DESC)

---

### 4. financial_snapshots

Stores financial data snapshots from Xero (or manual entry).

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| user_id | UUID (FK) | References users(id) |
| snapshot_date | TIMESTAMP | When snapshot was taken |
| cash_balance | DECIMAL(12,2) | Current cash on hand |
| accounts_receivable | DECIMAL(12,2) | Money owed to business (AR) |
| accounts_payable | DECIMAL(12,2) | Money business owes (AP) |
| monthly_revenue | DECIMAL(12,2) | Revenue this month |
| monthly_expenses | DECIMAL(12,2) | Expenses this month |
| burn_rate | DECIMAL(12,2) | Monthly cash burn |
| runway_months | DECIMAL(5,2) | Calculated runway |
| data_source | TEXT | 'xero' or 'manual' |
| raw_data | JSONB | Full Xero API response |
| created_at | TIMESTAMP | Record creation time |

**RLS Policies:**
- Users can view, insert, update, and delete their own snapshots only

**Indexes:**
- `idx_financial_snapshots_user_id` on user_id
- `idx_financial_snapshots_date` on snapshot_date (DESC)

---

### 5. policy_rules

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

### 6. decision_log

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

### 7. documents

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

### 8. document_chunks

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

## Relationships
```
users (1) ──< (many) conversations
conversations (1) ──< (many) conversation_messages
users (1) ──< (many) financial_snapshots
users (1) ──< (many) policy_rules
users (1) ──< (many) decision_log
users (1) ──< (many) documents
documents (1) ──< (many) document_chunks
```

---

## Migrations

All schema changes are tracked in `db/migrations/`:
- `001_initial_schema.sql` - Initial database setup
- `002_add_conversation_history_to_decision_log.sql` - Adds a dedicated JSONB field for chat transcripts
- `003_chat_rag_schema_foundation.sql` - Adds chat history tables, document tables, and vector-ready chunk storage

---

## Access Patterns

### Common Queries

**Get latest financial snapshot:**
```sql
SELECT * FROM financial_snapshots
WHERE user_id = $1
ORDER BY snapshot_date DESC
LIMIT 1;
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
- **xero_connections** table - Store Xero OAuth tokens
- **scenarios** table - Store "what-if" scenario configurations
- **forecasts** table - Store AI-generated forecasts
- **document extraction pipeline** - Promote uploaded document data into structured financial snapshots

---

**Last Updated:** March 31, 2026 by Rafael Manubay
