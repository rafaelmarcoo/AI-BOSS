# AI-BOSS Database Schema

**Database:** Supabase (PostgreSQL)  
**Created:** March 22, 2025  
**Last Updated:** March 22, 2025

---

## Overview

The database consists of 4 main tables:
- **users** - User profiles (extends Supabase Auth)
- **financial_snapshots** - Point-in-time financial data from Xero
- **policy_rules** - Business rules and compliance policies
- **decision_log** - Audit trail of all AI decisions and tool usage

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

### 2. financial_snapshots

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

### 3. policy_rules

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

### 4. decision_log

Audit trail of every AI interaction and decision.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| user_id | UUID (FK) | References users(id) |
| user_query | TEXT | What the user asked |
| ai_response | TEXT | What the AI responded |
| conversation_history | JSONB | Full chat exchange used to generate the response |
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

---

## Relationships
```
users (1) ──< (many) financial_snapshots
users (1) ──< (many) policy_rules
users (1) ──< (many) decision_log
```

---

## Migrations

All schema changes are tracked in `db/migrations/`:
- `001_initial_schema.sql` - Initial database setup
- `002_add_conversation_history_to_decision_log.sql` - Adds a dedicated JSONB field for chat transcripts

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

---

## Future Enhancements

Planned for Sprint 2+:
- **xero_connections** table - Store Xero OAuth tokens
- **scenarios** table - Store "what-if" scenario configurations
- **forecasts** table - Store AI-generated forecasts

---

**Last Updated:** March 22, 2025 by Rafael Manubay
