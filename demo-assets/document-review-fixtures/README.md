# Phase 4 document review manual test pack

These files contain synthetic financial data only. Use a safe local or test
Supabase project after migrations through `016_runway_currency_unit.sql` have
been applied. Do not run this checklist against production customer data.

## Important runway rule

Runway is a duration measured in months. It is not money and must not be labelled
NZD or AUD. The fixtures therefore leave runway currency blank. Do not repair a
runway candidate by assigning a currency just to make approval pass.

The monetary inputs used to calculate runway - cash, accounts receivable,
accounts payable, and burn rate - must still share one supported currency.

## Fixture index

| File | Purpose | Main expected result |
| --- | --- | --- |
| `01-valid-nzd-history.csv` | Clean three-month NZD history | 18 review candidates; current runway is calculated from the latest compatible inputs without a direct runway row |
| `02-review-corrections.csv` | Correction and exclusion | Missing date and USD require correction/exclusion; headcount is not extracted |
| `03-mixed-currency.csv` | Currency isolation | NZD and AUD remain separate |
| `04-runway-unit.csv` | Unit semantics | Runway is shown in months with no currency |
| `05-no-metrics.csv` | Empty extraction state | Original preview works; **No financial metrics found** |
| `06-unsupported.txt` | Unsupported extension | Rejected before upload |
| `07-corrupt.pdf` | Corrupt PDF | Understandable failure; original remains retained |
| `08-corrupt.xlsx` | Corrupt workbook | Understandable failure; original remains retained |
| `09-empty.csv` | Empty upload | Rejected as empty |
| `10-multi-sheet-financial-review.xlsx` | Sheets, formulas, dates, merged heading, hidden/empty sheets | Suggested financial sheets, cached formula accepted, uncached formula warned/excluded |
| `11-text-financial-statement.pdf` | Two-page text PDF | PDF preview, page/excerpt evidence, review candidates |
| `12-scanned-financial-statement.pdf` | Image-only PDF | Stored and previewable; OCR/extraction unavailable |
| `13-locked-financial-statement.pdf` | Password-protected PDF | Password-specific recoverable failure |
| `16-wide-55-columns.csv` | Preview column cap and pagination | At most 50 displayed columns and 100 rows per page |
| `generated-local/14-too-large.pdf` | 15 MB upload limit | Rejected because it is exactly 15 MB + 1 byte |
| `generated-local/17-too-many-selected-rows.csv` | 50,000-row processing limit | Rejected because it has 50,001 non-empty data rows |

Password for `13-locked-financial-statement.pdf`: `AI-BOSS-test-2026`.
AI-BOSS should report that it cannot process the protected PDF; do not enter the
password into the app.

The two large boundary files are intentionally ignored by Git. Generate or
refresh them before testing limits:

```bash
npm run fixtures:document-review
```

## 1. Preflight

1. Open the Phase 4 branch/worktree.
2. Confirm `.env.local` exists without printing its contents:

   ```bash
   test -f .env.local && echo ".env.local is ready"
   ```

3. Confirm migrations 015 and 016 appear in Supabase migration history, then run
   the read-only schema verification query from the Phase 4 handoff. Every
   object check must be `true`.
4. Run the automated checkpoint:

   ```bash
   npx tsc --noEmit
   npm test -- --runInBand
   npm run lint
   npm run build
   git diff --check
   ```

5. Start the app:

   ```bash
   npm run dev
   ```

6. Sign in with a test account. Record the current dashboard values and existing
   documents so that old data is not mistaken for newly approved data.
7. For a repeat run, use a fresh test account or delete the earlier synthetic
   `01-valid-nzd-history.csv` upload before starting section 2. Start a new chat
   conversation so the first answer is definitely generated before approval.

## 2. Clean CSV and the pre-approval trust boundary

1. From the landing page, upload `01-valid-nzd-history.csv`.
2. Confirm the landing page stays open and shows processing progress.
3. Wait for **Review extracted data**, then open it.
4. Confirm the document state says **Review required**, not User-confirmed.
5. Confirm the Original document is on the left and Extraction review is on the
   right at desktop width.
6. Scroll down the candidate list. The Original document panel must remain
   visible. Scroll inside its table to inspect later rows.
7. Before approval, return to the dashboard. The new values must not appear in
   cards, history, forecasts, scenarios, or deterministic calculations.
8. Ask chat:

   ```text
   What does 01-valid-nzd-history.csv say about cash?
   ```

9. Chat may quote exact document values, but it must label them as unreviewed
   evidence and must not calculate a decline, average, percentage, trend,
   forecast, or runway from them.
10. Confirm the right side says **Document evidence workspace** and **Review
    required**. It must not show a runway summary, missing-metric analysis, or
    runway-planning follow-ups for this evidence question.
11. Return to the review page. Confirm every valid candidate is preselected as
    Include, while the document is still Review required and unavailable to
    calculations.
12. Test **Exclude all**, **Clear selections**, and **Include all valid**. None
    may publish observations.
13. Confirm **Use these values in AI-BOSS.** stays disabled while any candidate
    is undecided or invalid and until the final review acknowledgement is ticked.
14. Tick **I reviewed these values against the original document.** Change one
    candidate and confirm the acknowledgement resets, then review and tick it again.
15. Select **Use these values in AI-BOSS.**
16. Confirm the state becomes **User-confirmed**.
17. Return to the same dashboard conversation used in step 8. The earlier
    pre-approval answer should remain unchanged as historical evidence; AI-BOSS
    must not rewrite an answer that was generated while the document was pending.
18. In that same conversation, ask the exact question again:

    ```text
    What does 01-valid-nzd-history.csv say about cash?
    ```

19. Confirm the second-turn request succeeds. The UI must not show **An
    unexpected error occurred**, and the server must return `POST /api/chat 200`
    without `content.findIndex is not a function`.
20. Confirm the new answer uses the User-confirmed structured history, cites
    `01-valid-nzd-history.csv`, and may now report the deterministic movement:

    ```text
    NZD 100,000 -> NZD 90,000 -> NZD 80,000
    Decrease: NZD 20,000 (20%)
    ```

21. Confirm the right side is no longer limited to **Document evidence
    workspace / Review required** for the latest turn. It should show the live
    financial workspace and the confirmed cash-history chart. **Cash runway**
    must show `4.71 months` and **Working-capital-adjusted runway** must show
    `4.82 months`, both labelled calculated. Neither may require a direct runway
    row. The old workspace should say **Historical snapshot** because its answer
    was generated before approval.
22. Confirm the latest approved monetary values are available to the dashboard
    and tools. Ask:

    ```text
    Calculate both my cash runway and working-capital-adjusted runway from User-confirmed values. Show both formulas and the source.
    ```

23. Expected calculations from the latest May rows:

    ```text
    Cash runway: 80,000 / 17,000 = 4.71 months
    Working-capital-adjusted runway:
    (80,000 + 16,000 - 14,000) / 17,000 = 4.82 months
    ```

24. Confirm both calculated measures identify the document as their source and
    are not stored or presented as uploaded `runway_months` observations.
25. Ask `Show my historical runway trend.` Expected calculated cash-runway
    points are `6.67` months (March), `5.63` months (April), and `4.71` months
    (May). The historical runway tool should separately report adjusted points
    of `7.33`, `6.00`, and `4.82` months.

## 3. Candidate correction, exclusion, and audit evidence

1. Upload `02-review-corrections.csv` from the chat upload control.
2. Confirm chat stays open while the document processes.
3. Open **Review extracted data**.
4. Confirm `Office headcount` is not presented as a financial metric candidate.
5. Include Accounts receivable without changing its missing date. Approval must
   remain blocked.
6. Add reporting date `2026-06-30`.
7. Correct Accounts payable from the deliberately parenthesised `-9000` to
   `9000`, or exclude it if a negative liability is truly intended.
8. For Monthly expenses, either change USD to NZD/AUD only if that is the intended
   correction, or choose Exclude. For this synthetic test, choose Exclude.
9. Change one included value, for example Cash at bank from `75000` to `75500`.
10. Choose Include or Exclude for every remaining candidate.
11. Confirm the card still shows the original value, currency, and reporting
    evidence next to the corrected values.
12. Approve the review.
13. Confirm `75500` is published, the excluded USD row is not published, and the
    document is labelled User-confirmed.

## 4. XLSX worksheet selection and formula handling

1. Upload `10-multi-sheet-financial-review.xlsx`.
2. Confirm AI-BOSS lists five sheets:
   `Summary`, `Cash Flow`, `AUD Detail`, hidden `Archive`, and empty `Notes`.
3. Confirm `Cash Flow`, `Summary`, and `AUD Detail` are suggested in that
   deterministic order.
4. Confirm empty `Notes` cannot be selected. `Archive` must be identified as
   hidden and must not be suggested.
5. Select `Summary` only and reprocess.
6. Confirm the Summary Cash burn formula has cached value `15000` and can create
   a candidate.
7. Confirm the Summary Runway value displays approximately `7.33 months` and its
   original currency is blank.
8. Select `Cash Flow` and `AUD Detail`, then reprocess again.
9. Confirm the uncached Cash Flow formula is excluded and displays a warning
   identifying sheet `Cash Flow`, row 7, column 2.
10. Confirm Excel dates appear as `YYYY-MM-DD`, merged title rows do not become
    fake metrics, and AUD candidates remain AUD.
11. While the new extraction awaits review, confirm any observations from the
    previously approved run remain calculation truth.
12. Approve a valid subset. Confirm the old observations are replaced only after
    the confirmation succeeds.

## 5. Text PDF extraction and page evidence

1. Upload `11-text-financial-statement.pdf`.
2. Open the review page and confirm the original two-page PDF loads in the left
   preview.
3. Confirm extracted candidates show source page and excerpt evidence.
4. Compare each candidate to the visible page before deciding Include/Exclude.
5. Confirm the management commentary can be used by chat as evidence before
   approval, while PDF-derived candidate metrics cannot drive calculations.
6. Correct or exclude any ambiguous candidate, then approve the complete review.

## 6. Scanned PDF and no-metrics states

1. Upload `12-scanned-financial-statement.pdf`.
2. Confirm the original remains stored and previewable.
3. Confirm AI-BOSS states that the PDF appears scanned/image-only and OCR or
   extraction is unavailable.
4. Confirm it does not invent candidates from the visible image.
5. Upload `05-no-metrics.csv`.
6. Confirm the table preview works and the review side says
   **No financial metrics found**.

## 7. Mixed currencies

1. Upload `03-mixed-currency.csv` and review all candidates.
2. Confirm NZD rows remain NZD and AUD rows remain AUD.
3. Approve the review.
4. In history and forecasts, select each currency separately.
5. Confirm AI-BOSS never silently converts, adds, or combines the two series.
6. A calculation requiring one shared currency must be unavailable if its inputs
   would cross NZD and AUD.

## 8. Runway unit regression test

1. Upload `04-runway-unit.csv`.
2. Confirm all three candidates are `runway_months` with values `7.33`, `6.00`,
   and `4.82` and blank currency.
3. The correct behaviour is to show unit **months**, hide/disable monetary
   currency editing, and allow valid runway candidates to remain currency-free.
4. Include all three candidates and approve them. Confirmation must succeed and
   publish observations whose currency is `NULL`.

## 9. Preview limits and responsive behaviour

1. Upload `16-wide-55-columns.csv`.
2. Confirm preview page 1 shows at most 100 rows and at most 50 columns.
3. Confirm the UI explains that only the first 50 of 55 columns are displayed.
4. Use keyboard focus and Enter/Space to move to preview page 2.
5. At a wide desktop viewport, confirm side-by-side layout and sticky Original
   document behaviour.
6. At a narrow/mobile viewport, confirm the panels stack, nothing is sticky, and
   there is no horizontal page overflow.
7. Test Tab, Shift+Tab, select arrow keys, Include/Exclude, pagination, and the
   approval button. Focus must remain visible and labels meaningful.

## 10. Invalid and boundary files

Upload each file separately and record the exact message:

1. `09-empty.csv` - rejected as empty.
2. `06-unsupported.txt` - rejected because only CSV, XLSX, and PDF are supported.
3. `07-corrupt.pdf` - processing fails understandably; original remains retained.
4. `08-corrupt.xlsx` - processing fails as corrupt/password-protected/unreadable;
   original remains retained.
5. `13-locked-financial-statement.pdf` - password-specific PDF failure; original
   remains retained.
6. `generated-local/14-too-large.pdf` - rejected because the 15 MB limit is
   exceeded.
7. `generated-local/17-too-many-selected-rows.csv` - accepted by the 15 MB upload
   validation but rejected during processing because it has more than 50,000
   selected non-empty rows.

For a password-protected XLSX check, make a copy of
`10-multi-sheet-financial-review.xlsx` in Excel, protect/encrypt the copy with a
temporary password, upload it, then delete that local copy after recording the
result. The repository does not store passwords or a reusable encrypted Office
file.

## 11. Reprocessing and rollback

1. Open a User-confirmed document and choose Reprocess.
2. While processing and while the new candidates are unapproved, confirm the old
   approved observations remain available.
3. Submit an invalid review, such as leaving one included candidate without a
   date. Confirm nothing is partially published.
4. Complete the review and approve it. Confirm replacement happens once, for
   only that document.
5. Confirm original payloads and old extraction runs remain available as audit
   evidence.

## 12. Ownership, Recent Activity, and legacy compatibility

1. Sign in as a second test user.
2. Request the first user's detail, preview, reprocess, and confirm URLs.
3. Expect a non-revealing denial/not-found response with no storage path, signed
   URL, candidate data, or document-existence detail.
4. Return to the first user and confirm Recent Activity contains only documents,
   conversations, and scenarios visible to that user.
5. Open a pre-migration legacy document. Existing observations must remain
   usable, but the UI must say review is recommended rather than User-confirmed.

## 13. Evidence to record

For each test, record:

- Date and environment.
- Commit/branch and migration-015/migration-016 results.
- Browser and viewport width.
- Fixture filename.
- Expected result, actual result, and Pass/Fail.
- Screenshot for important states or failures.
- Document ID only when needed for debugging; never record signed preview URLs,
  storage paths, tokens, or service-role credentials.
