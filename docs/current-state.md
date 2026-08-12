# AI-BOSS Current State

Last updated: 10 August 2026  
Main branch: `9784932` (`Merge PR #15: multi-user accounts`)

## Current Product Position

AI-BOSS is a multi-source financial decision-support layer. It is not a
replacement for Xero, QuickBooks, or an accountant. Its current value is in
source-aware financial questions, document evidence, runway/scenario analysis,
and an emerging generative financial interface.

## Verified On Main

The following checks passed before the latest merges:

- `npm test -- --runInBand`: 33 suites, 113 tests
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`

## Recently Merged

### Landing Page and Gen UI

- Authenticated users now enter through `/landing`, which can start a new chat
  or open a previous conversation in the dashboard.
- The dashboard can persist validated assistant `ui_payload` data and render
  Gen UI financial widgets from a structured plan with fallbacks.
- Selection-based prompts, resizable chat/dashboard panels, and conversation
  navigation remain part of the dashboard experience.

### Multi-User Company Conversations

- New users choose `admin` or `employee` when signing up.
- Admins create a new company; employees select an existing company to join.
- Conversations support `private`, `company`, and `admins` visibility.
- Company and role-aware read policies apply to conversations and messages.
- Existing accounts with a company name are backfilled as `admin` when the
  role migration runs.
- Company names are unique after trimming and case normalization.

## Database Deployment Required

Code is merged, but the Supabase database must run migrations `009` through
`012` before the Gen UI payload and multi-user features are used in a deployed
environment. In particular, this creates `companies`, adds role/company chat
fields, and installs the conversation access policies.

## Current Boundaries and Gaps

- Company/role visibility currently applies to conversations and messages.
  Documents and financial metric observations remain user-owned; they are not
  yet shared at a company level.
- Admins can create a company, but there is no separate admin invite,
  employee-management, or role-change screen yet.
- Company membership currently maps through the profile company name. A
  dedicated company-membership table is the scalable future design.
- CSV uploads can create deterministic financial metric observations. PDFs are
  retrieved as RAG evidence; they do not update dashboard metrics. XLSX is not
  supported yet.
- Forecasting and historical trend support are still early/rough. Proper 3- and
  6-month forecasting plus backtesting remain final-stretch work.
- Xero is the strongest demo path. QuickBooks, FreshBooks, and MYOB have
  connector foundations but are not yet equally proven live integrations.

## Immediate Final-Stretch Priorities

1. Apply and smoke-test migrations `009`–`012` in a safe Supabase environment.
2. Manually test admin signup, employee signup, and each conversation
   visibility mode with two accounts from the same company.
3. Build deterministic historical forecasting and backtesting.
4. Improve CSV/PDF ingestion and add XLSX support.
5. Complete the final report, poster, presentation, demo script, and QA pass.
