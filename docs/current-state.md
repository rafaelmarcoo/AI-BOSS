# AI-BOSS Current State

Last updated: 28 August 2026

## Current Product Position

AI-BOSS is a document-led financial decision-support workspace. It does not
replace accounting software or professional advice. Its current value is in
reviewed financial-file ingestion, source-aware questions, document evidence,
and deterministic runway, forecast, and scenario analysis.

## Verified On The Phase 4 Branch

The following checks passed on 28 August 2026 before final commit:

- `npm test -- --runInBand`: 74 suites, 279 tests
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- `git diff --check`

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

Before deployment, confirm that the target Supabase database has every required
migration through `015_document_extraction_review.sql`. Migration `015` is the
schema prerequisite for XLSX types, extraction runs/candidates, review status,
RLS, and transactional publication of User-confirmed observations.

## Current Boundaries and Gaps

- Company/role visibility currently applies to conversations and messages.
  Documents and financial metric observations remain user-owned; they are not
  yet shared at a company level.
- Admins can create a company, but there is no separate admin invite,
  employee-management, or role-change screen yet.
- Company membership currently maps through the profile company name. A
  dedicated company-membership table is the scalable future design.
- CSV, XLSX, and PDF originals are supported up to 15 MB. Text PDFs can be
  extracted; scanned PDFs remain previewable but OCR is not available.
- New document-derived metrics remain candidates until the owner explicitly
  includes/excludes every candidate and approves valid metric, value, NZD/AUD
  currency, and reporting-date fields. Approved values are User-confirmed.
- Historical connector code and migrations remain in the repository, but
  accounting connectors are outside the current product setup and UI scope.
- Fixed-origin deterministic forecast backtesting is maintained as automated
  test/report evidence rather than another product screen.

## Immediate Final-Stretch Priorities

1. Apply and smoke-test all unapplied migrations through `015` in a safe
   Supabase environment.
2. Manually test admin signup, employee signup, and each conversation
   visibility mode with two accounts from the same company.
3. Execute the manual document-review acceptance checklist in a safe
   environment with two accounts and non-sensitive fixtures.
4. Complete the final report, poster, presentation, and demo script.
