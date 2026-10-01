# Integrating `feat/imageextraction` with `main`'s review system

## The short version

While my branch added an attributes/items matrix and an LLM-based extractor for
PDF/DOCX/text, `main` independently built a full **review-before-trust** pipeline:
upload --> extract into unconfirmed *candidates* --> a dedicated review page --> the user
explicitly confirms --> only then does anything become a real `financial_metric_observations`
row. It has its own tables, a `SECURITY DEFINER` Postgres function, and a currency
policy baked into a `CHECK` constraint.

My branch has no concept of any of this. `processDocument` writes straight to
`financial_metric_observations`, no confirmation step exists, and there is a
second, parallel place to store data (`document.metadata.extractedItems`) that
main's system never looks at.

Below is what specifically breaks, and a proposed way to fit my branch into
main's model instead of running two systems side by side.

## What main built (as of `origin/main`)

- `db/migrations/015_document_extraction_review.sql`, two new tables,
  `document_extraction_runs` and `document_extraction_candidates`, plus a
  `documents.financial_review_status` column (`legacy | not_required | pending | confirmed`).
- `lib/documents/extraction-candidates.ts`, turns parsed CSV/XLSX/PDF metrics into
  candidate drafts, with warnings (missing currency, unsupported currency, missing
  reporting date, duplicates).
- `lib/documents/extraction-review-persistence.ts`, creates a run, saves candidates,
  and calls the confirm step.
- `public.confirm_document_extraction()` (SQL function), the only path allowed to
  write `financial_metric_observations` from a document. It re-validates every
  candidate's currency, metric key and reporting date server-side, deletes the
  document's old observations, and inserts the confirmed ones, all in one transaction.
- `app/dashboard/documents/[documentId]/DocumentReviewWorkspace.tsx`, the page
  where the user reviews and confirms candidates. Separate from the chat's upload flow.
- Confirm/preview/reprocess API routes under `app/api/documents/[documentId]/`.

Only PDF, CSV and XLSX ever produce candidates. Text, DOCX and image documents are
not part of this system at all, see below.

## What my branch built that doesn't fit this model

- `lib/documents/text-metric-extraction.ts`, an LLM extractor for PDF/DOCX/text,
  producing fixed metrics **and** a list of items (`ExtractedItem[]`) with free-form
  attributes.
- `lib/financial-data/attributes.ts`, price x quantity computation, attribute parsing.
- `lib/financial-data/item-matrix.ts`, turns `document.metadata.extractedItems` into
  a display matrix, plus the manual-edit functions (`applyItemValueEdit`,
  `applyItemAttributeEdit`, `applyItemAppend`).
- `processDocument` (my version) calls `saveFinancialMetricObservations` directly,
  no run, no candidate, no confirmation, no `financial_review_status`.
- `UploadReviewModal`, shown immediately after upload in the chat flow, edits
  `document.metadata` directly via `/api/documents/[id]/items` and `/metrics`.
- A currency selector offering **NZD/USD**.

## Three concrete collisions (not style differences, things that break or contradict)

### 1. The `file_type` constraint was narrowed back down

My committed migrations 014/015 built the constraint up to
`('pdf', 'csv', 'image', 'xlsx', 'text', 'docx')`. Main's migration 015 (written
independently, for the review system) reset it to `('pdf', 'csv', 'xlsx')`. Whichever
migration is applied last in Supabase wins, so without a reconciling migration,
uploading an image, a text file or a DOCX would be rejected by the database itself,
silently undoing three features from my branch.

### 2. Currency: NZD/AUD is enforced in SQL, not just in the UI

`document_extraction_candidates.currency` has
`CHECK (currency IS NULL OR currency IN ('NZD', 'AUD'))`, and
`confirm_document_extraction()` re-checks `UPPER(review.currency) NOT IN ('NZD', 'AUD')`
before allowing a candidate to be included. My USD option isn't just a different
UI choice, it's rejected at the database layer as it stands today. This is a product
decision (does the business want USD support at all?), not something to resolve by
picking a side in a merge.

### 3. Two different XLSX parsers

Main added `exceljs` and wrote `lib/documents/tabular.ts`, a proper multi-sheet
parser (`ParsedTabularData` / `ParsedTabularSheet`), already wired into the candidate
system, with hidden-sheet detection and per-sheet warnings. My branch added
`xlsx` (SheetJS) and extended the existing single-sheet `ParsedCsvData` path in
`parsing.ts` for the attribute columns. Both work; keeping both means two dependencies
and two code paths doing the same job, with only one of them ever producing review
candidates.

## Proposed design (draft, for discussion, not yet built)

The guiding idea: **keep the review/confirm gate for anything that becomes a trusted
fixed metric** (main's whole point), but **keep items/attributes as supplementary data
outside that gate**, since they were never meant to feed forecasts or the dashboard,
only to be visible and editable by the user. That matches the "Box B, not a new table"
decision made earlier this session, and means the items/attributes feature doesn't
need its own review/confirm machinery at all.

1. **One migration that reconciles `file_type` properly.** A single new migration,
   applied after all of main's and mine, with the full set:
   `('pdf', 'csv', 'xlsx', 'image', 'text', 'docx')`. This replaces the need to reason
   about migration order at all for this constraint.

2. **Extend `extractDocumentCandidates` to cover text/DOCX/image, using the LLM extractor.**
   Right now it only branches on `pdf` (deterministic regex) and tabular
   (`csv`/`xlsx`). Add branches for `text`/`docx` calling
   `extractTextFinancialMetrics`, and for `image` calling the existing
   `extractImageMetrics`. Both already return `AvailableFinancialMetricValue[]`-shaped
   `metrics` today, since I added canonical metric matching to image extraction too
   (the same cash/revenue/etc. recognition CSV and PDF already had). So they slot
   into `metricToCandidate` the same way PDF/CSV do today, with no shape work needed
   first. The `items`/`itemAttributes` part of their result does **not** become a
   candidate, it's saved straight to `document.metadata` as today, since it was
   never meant to need confirmation.

3. **Worth a real discussion: should the LLM PDF extractor replace main's deterministic
   one?** The CIMA test earlier this session showed the deterministic regex extractor
   getting 0 usable metrics on a real multi-statement PDF, versus the LLM extractor
   getting accurate figures with correct entity/period tagging. If accuracy matters
   more than determinism for PDFs specifically, the LLM extractor could become the PDF
   path in `extraction-candidates.ts` (CSV/XLSX stay deterministic, they already work
   well). This is a call for the project leader and me, not something to decide by default.

4. **Currency: a decision for the two of us, not a merge resolution.** Either (a) drop
   USD from my currency selector and standardize on main's NZD/AUD, or (b) widen
   main's currency support to add USD everywhere it's enforced: the two `CHECK`
   constraints, `candidateWarnings()`, and `confirm_document_extraction()`'s validation.
   Option (b) is more work and touches the trust-boundary SQL function main built
   carefully, don't do it without agreement.

5. **Retire the separate XLSX parser.** Rewrite the attribute-column logic (currently in
   `csv.ts`, reading `ParsedCsvData`) to read from main's `ParsedTabularSheet` instead,
   structurally very similar (`headers`/`rows`/`cells`), so this is a rename-and-adjust
   job, not a rewrite. Then drop the `xlsx` dependency.

6. **Two review UIs become one job split two ways.** `DocumentReviewWorkspace` keeps
   owning fixed-metric review/confirm (main's job, unchanged). `UploadReviewModal`
   stops writing fixed metrics directly and becomes items/attributes only, the matrix
   table, manual attribute editing, add row/column. It shows immediately after upload
   (no confirm needed, since items were never trust-gated), while the fixed metrics for
   that same document wait in `DocumentReviewWorkspace` until confirmed.

## Rough sizing

| Piece | Size |
|---|---|
| Reconciling `file_type` migration | Small |
| Wire text/DOCX/image into `extractDocumentCandidates` | Medium |
| Swap to `tabular.ts`, drop `xlsx` dependency | Medium |
| Currency decision + implementation (if widening to USD) | Medium, plus a SQL change to a security-definer function, reviewed carefully |
| Split `UploadReviewModal` vs `DocumentReviewWorkspace` responsibilities | Medium |
| LLM-replaces-regex decision for PDF (if agreed) | Small once the above is done, it's mostly a routing change |

The recommendation is to treat it
as its own PR after this branch lands, rather than block the merge on it, see the
open questions below.


