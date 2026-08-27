# Document review regression and acceptance checklist

Use this checklist after applying `db/migrations/015_document_extraction_review.sql` to a safe Supabase environment. The automated suite generates workbook/table fixtures in memory; the PDF extraction fixtures live in `test-fixtures/pdf-metric-extraction.ts`.

## Automated fixture coverage

| Area | Fixture or test evidence |
| --- | --- |
| CSV delimiters and encoding | Semicolon-delimited Windows-1252 input with source-row preservation |
| CSV limits | Empty, unsupported, over-15-MB, over-50,000-row, and wide-input rejection |
| XLSX worksheets | Deterministic suggestions, multiple selections, hidden sheets, merged headings, empty/unknown sheets, 25-sheet limit, and 200-column limit |
| XLSX values | Excel dates, cached formulas, missing formula cache warnings, currency/percentage formatting, and parentheses negatives |
| PDF extraction | Dated text, page/excerpt evidence, unsupported labels, duplicates, missing date, unsupported/missing currency, negative values, and runway units |
| PDF failure states | Image-only/scanned state, password-specific failure, corrupt-file failure handling, and retained originals |
| Review boundary | Pending candidates, correction, inclusion/exclusion, invalid included fields, duplicate decisions, complete-review requirement, and User-confirmed publication contract |
| Ownership | Authenticated route owner IDs, owner-filtered document queries, RLS policies, and owner/company-aware Recent Activity reads |
| Reprocessing | Selected worksheet payloads, prior-observation preservation, failed-run recording, and stale-chunk replacement |
| Forecast evidence | Fixed-origin backtesting, source/currency isolation, explicit-date requirement, insufficient history, absolute error, and zero-actual percentage omission |

Run the complete automated checkpoint:

```bash
npx tsc --noEmit
npm test -- --runInBand
npm run lint
npm run build
git diff --check
```

## Manual fixtures

Prepare files that contain no real customer data:

1. `valid-wide.csv`: dated NZD cash/revenue/expense rows plus more than 50 columns.
2. `mixed-currency.csv`: separate dated NZD and AUD rows, one missing date, one ambiguous date, a percentage, and a parentheses-negative value.
3. `multi-sheet.xlsx`: `Summary`, `Cash Flow`, hidden `Archive`, and empty `Notes` sheets; include cached and uncached formula cells and merged heading rows.
4. `text-statement.pdf`: clear reporting date, currency, labelled metrics, and a table spanning at least two pages.
5. `scanned-statement.pdf`: image-only pages with no text layer.
6. `locked.pdf` and `locked.xlsx`: password-protected files.
7. `corrupt.pdf` and `corrupt.xlsx`: supported extensions with invalid contents.
8. `too-large.pdf`: larger than 15 MB.
9. `unsupported.txt`: a non-supported extension.

## Manual acceptance flow

### Upload and processing

1. Upload one valid file from the landing page. Confirm the page stays in place, displays processing, and offers **Review extracted data**.
2. Upload another valid file from chat. Confirm chat stays open, the document list polls, and the review link appears after extraction.
3. Verify CSV, XLSX, and PDF are accepted; empty, oversized, corrupt, password-protected, legacy `.xls`, and unsupported files show understandable errors.
4. Verify failed and scanned originals remain listed and previewable/deletable. A scanned PDF must state that OCR/extraction is unavailable.

### Preview and worksheet selection

1. Open `/dashboard/documents/<id>` at desktop width. Confirm original and extraction review are side by side.
2. Repeat at a mobile width. Confirm the panels stack without horizontal page overflow.
3. For CSV/XLSX, confirm 100 rows per page by default and no more than 50 displayed columns. Change pages using keyboard only.
4. For XLSX, compare suggested worksheets with the fixture, select multiple non-empty sheets, and reprocess. Confirm hidden sheets are identified and empty sheets cannot be selected.
5. Confirm uncached formula cells are excluded with a warning; cached results and Excel dates match the workbook display.
6. For PDF, confirm the signed preview loads and source page/excerpt evidence points to the original.

### Explicit review and calculation trust

1. Before approval, ask chat about the uploaded file. It may cite chunks only as unreviewed evidence.
2. Check dashboards, forecasts, scenarios, and deterministic tools. New candidate values must not appear in calculations yet.
3. For every candidate, choose Include or Exclude. Confirm approval remains blocked while any candidate is undecided.
4. Include a candidate with a missing date, invalid value, or non-NZD/AUD currency. Confirm approval remains blocked.
5. Correct metric, value, currency, and reporting date. Confirm the original values remain visible beside corrections.
6. Select **Use these values in AI-BOSS.** Confirm included observations become available and are labelled **User-confirmed**; excluded candidates never enter calculation truth.
7. Verify NZD and AUD remain separate in history, forecasts, scenarios, and backtesting.

### Reprocessing, rollback, and legacy compatibility

1. Reprocess a User-confirmed document with different sheets. While processing and before new approval, confirm the old approved observations remain calculation truth.
2. Cause reprocessing to fail with a corrupt replacement/test storage object. Confirm the old observations remain and the failed run/original can be inspected or retried.
3. Submit an incomplete or invalid confirmation payload using an API client. Confirm the whole transaction rolls back: candidate decisions, observations, run status, and document review status are unchanged.
4. Open a legacy document. Confirm its existing observations remain usable and the UI says review is recommended rather than claiming User-confirmed.

### Ownership, activity, and accessibility

1. With a second account, request another owner’s detail, preview, reprocess, and confirm URLs. Confirm no file, signed URL, candidate, path, or existence detail is exposed.
2. Confirm Recent Activity contains only documents owned by the user plus conversations/scenarios already accessible under their existing visibility rules.
3. Navigate the review page using Tab, Shift+Tab, arrow keys in selects, Space/Enter on Include/Exclude, and keyboard pagination. Confirm visible focus and meaningful labels.
4. Check loading, empty, failed, scanned, review-required, User-confirmed, and no-metrics states in both narrow and wide layouts.

Record date, environment, migration version, browser/device widths, fixture names, pass/fail result, and screenshots for every manual run. Do not mark this checklist executed until those observations have actually been collected.
