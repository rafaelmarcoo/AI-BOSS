# AI-BOSS Final Demonstration Video Script

## Recommended length

Target **10–12 minutes**.

This is long enough to demonstrate the document trust boundary, dual runway
calculations, forecasts, and the existing Scenarios workspace without turning
the recording into a complete acceptance-test session.

If a shorter limit is required, use the condensed plan near the end of this
document.

## Demo objective

The video should show that AI-BOSS is a financial decision-support application
that:

- accepts CSV, XLSX, and PDF financial documents;
- preserves the original document as evidence;
- requires users to review, correct, include, or exclude extracted values;
- prevents unreviewed candidates from entering calculations;
- calculates financial results using deterministic TypeScript services;
- displays both cash runway and working-capital-adjusted runway with their
  assumptions;
- uses User-confirmed values in history, forecasts, and scenarios; and
- keeps AI explanation separate from trusted financial arithmetic.

## Files required for the recording

Open this folder in Finder before recording:

```text
demo-assets/document-review-fixtures
```

Prepare these files:

1. `01-valid-nzd-history.csv`
   - Main CSV used to demonstrate the complete review and approval workflow.
   - Contains three months of compatible NZD financial history.

2. `10-multi-sheet-financial-review.xlsx`
   - Used to demonstrate worksheet suggestions, multiple worksheet selection,
     hidden and empty sheets, and cached formula handling.

3. `11-text-financial-statement.pdf`
   - Used to demonstrate a previewable text PDF with page and excerpt evidence.

4. `12-scanned-financial-statement.pdf`
   - Used to demonstrate a stored and previewable scanned PDF for which OCR is
     unavailable.

Do not use `02-review-corrections.csv` in the main recording. The main CSV will
already demonstrate one correction and one exclusion, which keeps the story
focused and avoids introducing incompatible June data.

## Values to change during the recording

When reviewing `01-valid-nzd-history.csv`:

1. Change the **31 May 2026 Cash at bank** value:

   ```text
   Original: 80000
   Corrected: 85000
   ```

2. Exclude **31 March 2026 Monthly expenses**:

   ```text
   Original: NZD 65000
   Decision: Exclude
   ```

3. Include every other valid candidate.

4. Select:

   ```text
   I reviewed these values against the original document.
   ```

5. Select:

   ```text
   Use these values in AI-BOSS.
   ```

Excluding March monthly expenses does not block runway because runway uses
monthly burn, not monthly expenses.

## Expected confirmed results

### Confirmed cash history

| Reporting date | Cash |
| --- | ---: |
| 31 March 2026 | NZD 100,000 |
| 30 April 2026 | NZD 90,000 |
| 31 May 2026 | NZD 85,000 |

Confirmed cash decreases by:

```text
NZD 15,000, or 15%, from March to May.
```

### Latest cash runway

```text
Cash / monthly burn
NZD 85,000 / NZD 17,000 = 5.00 months
```

### Latest working-capital-adjusted runway

```text
(Cash + accounts receivable - accounts payable) / monthly burn
(NZD 85,000 + NZD 16,000 - NZD 14,000) / NZD 17,000
= 5.12 months
```

### Expected historical runway points

| Reporting date | Cash runway | Working-capital-adjusted runway |
| --- | ---: | ---: |
| 31 March 2026 | 6.67 months | 7.33 months |
| 30 April 2026 | 5.63 months | 6.00 months |
| 31 May 2026 | 5.00 months | 5.12 months |

## Prompts required for the recording

Copy these into Notes before recording so they can be pasted quickly.

### Prompt 1: before approval

```text
What does 01-valid-nzd-history.csv say about cash?
```

### Prompt 2: after approval

```text
What does 01-valid-nzd-history.csv say about cash?
```

### Prompt 3: excluded evidence

```text
What happened to the March 2026 monthly expenses value?
```

### Prompt 4: dual runway

```text
Calculate both my cash runway and working-capital-adjusted runway from User-confirmed values. Show both formulas, reporting dates and the source.
```

## Pre-recording checklist

### Application preparation

Confirm database migrations 015 and 016 are applied to the Supabase environment
used for the demonstration.

Run:

```bash
git switch main
git pull origin main
npm install
npm run fixtures:document-review
npm run dev
```

Confirm `.env.local` exists without displaying its contents:

```bash
test -f .env.local && echo ".env.local is ready"
```

Do not show environment variables, API keys, Supabase credentials, or the SQL
editor during the recording.

### Test-account preparation

- Prefer a fresh test account.
- Otherwise, delete earlier synthetic document uploads.
- Remove or ignore earlier test scenarios.
- Start a new chat conversation.
- Confirm `01-valid-nzd-history.csv` is not already uploaded.
- Confirm old CSV 2 test values will not appear in source selectors.

### Recording preparation

- Turn on Do Not Disturb.
- Close email, WhatsApp, personal tabs, and unrelated applications.
- Hide bookmarks or browser tabs containing personal information.
- Use approximately 90% browser zoom.
- Record at 1080p if available.
- Keep the cursor movement slow.
- Pause briefly after every important result.
- Edit out long processing or model-response waits afterward.

## Timed recording plan

| Time | Section |
| --- | --- |
| 0:00–0:50 | Introduction and earlier AI-BOSS work |
| 0:50–1:30 | Brief Scenarios workspace preview |
| 1:30–2:20 | Upload CSV and explain processing |
| 2:20–3:10 | Ask chat before approval |
| 3:10–5:00 | Review, correct, exclude, and approve |
| 5:00–6:20 | Ask chat again after approval |
| 6:20–8:10 | Explain and demonstrate both runway measures |
| 8:10–9:10 | Runway history and forecasting |
| 9:10–10:30 | Scenario comparison using confirmed values |
| 10:30–11:30 | XLSX, PDF, Recent Activity, and conclusion |

# Full demonstration script

## 1. Introduction and earlier work

### Actions

1. Open AI-BOSS on the Dashboard.
2. Keep the Dashboard visible while introducing the product.

### Narration

> Hi, this is AI-BOSS, a financial decision-support application designed to
> help small businesses understand their financial position, analyse trends,
> forecast future values, and compare business decisions using their own
> financial information.
>
> Before this latest phase, I worked on the core dashboard, AI chat, historical
> financial analysis, deterministic forecasts, source-aware tools, specialist
> routing, voice input, conversation management, and the Scenarios workspace.
>
> An important architectural principle is that the language model does not
> perform trusted financial arithmetic. It interprets the request, selects an
> appropriate tool, and explains the result. Deterministic TypeScript services
> perform the actual financial calculations.
>
> The latest work focused on completing the document workflow and improving
> trust. An extracted value must now be reviewed and explicitly confirmed before
> it can affect dashboards, forecasts, runway, or scenarios.

## 2. Brief Scenarios workspace preview

### Actions

1. Select **Scenarios** in the navigation.
2. Briefly show:
   - Saved scenario library
   - Baseline and timing controls
   - Scenario adjustments
   - Comparison results area
3. Do not configure a scenario yet.
4. Select **Documents**.

### Narration

> The Scenarios workspace was one of the major features completed before this
> document-review phase.
>
> It allows a user to compare a baseline against up to three what-if scenarios.
> Users can model fixed or percentage changes, one-off or recurring cash flows,
> and different planning horizons.
>
> It compares a current-run-rate baseline with a historical-trend baseline.
> Scenario assumptions remain separate from actual financial observations, and
> saved results remain frozen until the user explicitly recalculates them.
>
> I will return to this workspace after confirming a document so I can show how
> reviewed financial data becomes a source-backed scenario baseline.

## 3. Upload the main CSV

### Actions

1. Upload:

   ```text
   01-valid-nzd-history.csv
   ```

2. Show the processing state.
3. Wait for **Review extracted data**.
4. Open the document review page.

### Narration

> AI-BOSS now supports CSV, XLSX, and PDF financial documents. The upload limit
> remains 15 megabytes.
>
> I am uploading a CSV containing three months of NZD financial history.
>
> Processing the document does not immediately publish the extracted numbers as
> trusted financial data. It creates review candidates that remain pending until
> the user confirms them.

## 4. Explain the document-review workspace

### Actions

1. Point to the original document on the left.
2. Point to the extraction candidates on the right.
3. Scroll through several candidate cards.
4. Show that the original panel remains visible.
5. Scroll inside the original table.

### Narration

> The original document appears on the left, and the extracted candidates
> appear on the right.
>
> The original is never changed by the review. It remains available as evidence.
>
> On desktop, the original panel stays visible while I review a long candidate
> list. Its table also has its own scroll area.
>
> Each candidate shows its source row, confidence, original values, and editable
> reviewed values.
>
> Valid candidates begin selected for inclusion to reduce repetitive work, but
> this does not mean they are already approved. The document still says Review
> required.

## 5. Demonstrate the preapproval trust boundary

### Actions

1. Return to the Dashboard or chat without approving the document.
2. Ask:

   ```text
   What does 01-valid-nzd-history.csv say about cash?
   ```

3. Point to the unreviewed warning and Document evidence workspace.

### Expected result

- Chat may list the original cash evidence:
  - March: NZD 100,000
  - April: NZD 90,000
  - May: NZD 80,000
- Chat should call the values unreviewed.
- It must not calculate the decline, trend, forecast, or runway.
- The generated UI should display **Review required**.

### Narration

> Before approval, chat may quote exact source values as unreviewed evidence.
>
> However, it cannot use these candidates for calculations, trends, forecasts,
> runway, or scenarios.
>
> The generated interface therefore shows a Document evidence workspace and a
> Review required state instead of presenting the numbers as trusted dashboard
> values.
>
> This is the main trust boundary: document text can be evidence, but only
> User-confirmed structured observations can become calculation truth.

## 6. Correct and exclude candidates

### Actions

1. Return to the document review page.
2. Find the **31 May 2026 Cash at bank** candidate.
3. Change:

   ```text
   80000 -> 85000
   ```

4. Point out that the original value remains visible.
5. Find **31 March 2026 Monthly expenses**, originally NZD 65,000.
6. Select **Exclude**.
7. Show the bulk controls without changing the completed decisions:
   - Include all valid
   - Exclude all
   - Clear selections
8. Confirm every other valid candidate is included.
9. Scroll to the review summary.
10. Tick:

    ```text
    I reviewed these values against the original document.
    ```

11. Select:

    ```text
    Use these values in AI-BOSS.
    ```

### Narration

> I will now demonstrate a correction and an exclusion.
>
> The extracted May cash value is 80,000 dollars. I will correct it to 85,000.
>
> The interface preserves the original 80,000-dollar value alongside my
> correction. This creates an audit trail rather than overwriting the evidence.
>
> I will also exclude the March monthly-expenses value. Exclusion does not erase
> the candidate. It remains available as audit evidence, but it cannot become a
> financial observation or calculation input.
>
> Large reviews also have controls to include all valid candidates, exclude all,
> or clear the current selections.
>
> Every candidate must receive a decision. Invalid included values, missing
> reporting dates, unsupported monetary currencies, and undecided candidates
> block confirmation.
>
> Finally, I must acknowledge that I reviewed the values against the original
> document.
>
> Selecting Use these values in AI-BOSS transactionally publishes only the
> included reviewed candidates. The document is now User-confirmed.

## 7. Ask the same question after approval

### Actions

1. Return to the same chat conversation.
2. Point out that the earlier answer remains unchanged.
3. Ask again:

   ```text
   What does 01-valid-nzd-history.csv say about cash?
   ```

### Expected result

- March: NZD 100,000
- April: NZD 90,000
- May: NZD 85,000
- Confirmed decrease: NZD 15,000 or 15%
- The answer says **User-confirmed**.
- The latest generated UI is no longer limited to the evidence workspace.

### Narration

> The earlier preapproval response remains unchanged because it is a historical
> snapshot of what AI-BOSS knew at that time.
>
> I will now ask the same question again.
>
> The new response uses the User-confirmed structured observations. It reports
> my corrected May value of 85,000 dollars and can now calculate the confirmed
> movement.
>
> This demonstrates that the original document evidence does not override the
> reviewed correction after approval.

## 8. Demonstrate excluded audit evidence

### Actions

Ask:

```text
What happened to the March 2026 monthly expenses value?
```

### Expected result

- Chat identifies the original NZD 65,000 candidate.
- Chat says it was explicitly excluded during document review.
- It explains that the value remains audit evidence.
- It does not treat the value as an approved calculation input.

### Narration

> AI-BOSS can also distinguish an explicitly excluded value from a missing or
> unreviewed value.
>
> The original candidate remains available for auditability, but the financial
> tools cannot use it.

## 9. Explain why AI-BOSS has two runway measures

### Actions

Ask:

```text
Calculate both my cash runway and working-capital-adjusted runway from User-confirmed values. Show both formulas, reporting dates and the source.
```

### Narration

> AI-BOSS now calculates two separate runway measures because they answer
> related but different business questions.
>
> During development and testing, I found that showing only one runway number
> could be misleading. A business may want to know how long the cash already in
> its bank account will last. It may also want a broader planning view that
> considers money expected from customers and bills still owed to suppliers.
>
> I reviewed common runway calculations and New Zealand small-business cash-flow
> guidance. Based on that investigation, I decided to display two clearly
> separated measures instead of hiding different assumptions inside one number.
>
> The first measure is cash runway.
>
> Cash runway answers: how long can the business continue using the cash already
> available?
>
> Its formula is cash divided by monthly burn.
>
> For this document, 85,000 dollars divided by 17,000 dollars gives exactly 5
> months.
>
> This is the more conservative view because it relies only on cash already held
> by the business.
>
> The second measure is working-capital-adjusted runway.
>
> This is a broader planning measure. It asks what runway could look like if
> current receivables are collected and current payables are paid.
>
> Its formula is cash, plus accounts receivable, minus accounts payable, divided
> by monthly burn.
>
> For this document, 85,000 dollars plus 16,000 dollars, minus 14,000 dollars,
> divided by 17,000 dollars gives approximately 5.12 months.
>
> I deliberately show both results because the adjusted figure relies on
> stronger assumptions. Receivables are expected money, but they are not yet
> cash in the bank. If customers pay late, the adjusted figure could overstate
> the liquidity actually available.
>
> Working-capital-adjusted runway is therefore an AI-BOSS planning measure, not a
> replacement for a formal accounting ratio. The interface exposes its formula
> and assumptions.
>
> AI-BOSS also requires all inputs to share the same source, currency, and
> reporting date. This prevents a mathematically valid but financially
> misleading result.

### Expected result

```text
Cash runway: 5.00 months
Working-capital-adjusted runway: 5.12 months
Source: 01-valid-nzd-history.csv
Reporting date: 31 May 2026
Currency: NZD
```

## 10. Demonstrate runway history and forecast

### Actions

1. Open **Financial trend and forecast**.
2. Select:

   ```text
   Financial metric: Runway
   View: History
   Runway plots: Both
   History range: All dates
   Source: 01-valid-nzd-history.csv
   ```

3. Show both plot lines.
4. Select **Cash runway** only.
5. Select **Working-capital-adjusted** only.
6. Return to **Both**.
7. Switch to **Forecast**.
8. Select **Next 6 months**.

### Expected history

```text
Cash runway: 6.67 -> 5.63 -> 5.00 months
Adjusted runway: 7.33 -> 6.00 -> 5.12 months
```

### Expected forecast behaviour

- History is shown with solid lines.
- Forecasts are shown with dashed lines.
- Forecasts begin from the latest May actual point.
- There is no unexplained visual gap.
- Future dates continue through correct calendar month ends.
- Missing adjusted dates remain gaps instead of invented values.

### Narration

> The dashboard now uses one Runway metric with controls for both measures,
> cash runway only, or working-capital-adjusted runway only.
>
> Displaying both lines allows the user to see how much the broader estimate
> depends on collecting receivables and paying current liabilities.
>
> History uses solid lines and forecasts use dashed lines. Each forecast is
> anchored to the latest actual observation.
>
> The forecast uses real calendar month ends, including February and months with
> 30 or 31 days.
>
> Missing adjusted-runway inputs remain visible as genuine gaps instead of being
> silently interpolated.

## 11. Demonstrate the source-backed Scenario workspace

### Actions

1. Select **Scenarios**.
2. Select the baseline:

   ```text
   01-valid-nzd-history.csv · NZD · latest 2026-05-31
   ```

3. Configure:

   ```text
   Planning horizon: 6 months
   Historical trend lookback: Last 3 months
   Scenario name: Hire one employee
   Calculation: Fixed amount
   Cash flow: Outflow
   Frequency: Recurring monthly
   Amount: 5000
   Start month: June 2026
   End month: Through horizon
   ```

4. Select **Run comparison**.
5. Show both result panels.
6. If time permits, save the result:

   ```text
   Library name: June hiring comparison
   Visibility: Private
   Action: Save calculated result
   ```

### Expected result

- The confirmed document appears as a selectable baseline.
- Opening liquidity is calculated as:

  ```text
  Cash + receivables - payables
  85,000 + 16,000 - 14,000 = NZD 87,000
  ```

- A recurring NZD 5,000 outflow over six months lowers scenario ending
  liquidity by NZD 30,000 relative to the matching baseline.
- Current-run-rate and historical-trend results remain separate.
- Scenario assumptions do not alter financial observations.

### Narration

> The confirmed document is now available as a source-backed scenario baseline.
>
> I will model hiring one employee at a confirmed employer cost of 5,000 dollars
> per month for six months.
>
> The scenario engine begins with available liquidity of cash plus receivables
> minus payables. It then compares the new scenario against both the current-run-
> rate and historical-trend baselines.
>
> The additional cost is 30,000 dollars over six months, so the scenario ends
> 30,000 dollars below its corresponding baseline.
>
> These calculations are deterministic. The AI explains the result, but it does
> not calculate the balances itself.
>
> Scenario assumptions remain separate from actual financial observations.
> Saved results also remain frozen until the user explicitly recalculates them.

## 12. Demonstrate XLSX support

### Actions

1. Return to **Documents**.
2. Upload:

   ```text
   10-multi-sheet-financial-review.xlsx
   ```

3. Open the review page.
4. Show the listed worksheets.
5. Show the suggested worksheets and selection controls.
6. Mention cached and uncached formulas.
7. Do not complete a full review unless additional time is available.

### Expected result

- Five sheets are listed:
  - Summary
  - Cash Flow
  - AUD Detail
  - Hidden Archive
  - Empty Notes
- Suggested order:
  - Cash Flow
  - Summary
  - AUD Detail
- Empty Notes cannot be selected.
- Archive is identified as hidden and is not suggested.
- Cached formula results may become candidates.
- An uncached formula produces a warning and is excluded.

### Narration

> AI-BOSS now supports multi-sheet XLSX workbooks using ExcelJS on the server.
>
> It suggests likely financial worksheets deterministically and allows users to
> select more than one sheet.
>
> Hidden and empty sheets are identified. Cached formula results may be used,
> but AI-BOSS warns and excludes formulas without cached values rather than
> guessing their results.

## 13. Demonstrate PDF states

### Text PDF actions

1. Upload:

   ```text
   11-text-financial-statement.pdf
   ```

2. Open its review page.
3. Show the PDF preview.
4. Show page and excerpt evidence on candidates.

### Text PDF narration

> Text-based PDFs remain previewable and may produce conservative financial
> candidates with page numbers and evidence excerpts.
>
> PDF candidates still require the same explicit review before calculations can
> use them.

### Scanned PDF actions

1. Upload:

   ```text
   12-scanned-financial-statement.pdf
   ```

2. Open the document.
3. Show the scanned or OCR-unavailable state.

### Scanned PDF narration

> Scanned PDFs are retained and previewable, but OCR is outside the current
> scope.
>
> AI-BOSS clearly states that extraction is unavailable and does not invent
> candidates from the image.

## 14. Recent Activity and conclusion

### Actions

1. Return to the Dashboard.
2. Show Recent Activity if visible.
3. Point out the uploaded documents, conversation, and saved scenario.

### Narration

> Recent Activity now uses authenticated documents, conversations, and scenarios
> instead of hard-coded example data.
>
> To summarise, this phase added reliable CSV, XLSX, and PDF ingestion;
> original-document previews; candidate correction and exclusion; explicit
> User-confirmed approval; correction and exclusion audit evidence; safer chat
> behaviour; dual runway calculations; dual runway history and forecasting; and
> integration with the existing Scenarios workspace.
>
> The central design principle is that AI-BOSS may use unreviewed documents as
> clearly labelled evidence, but only User-confirmed structured observations can
> drive trusted financial calculations.
>
> This makes the system more explainable, auditable, and reliable for SME
> financial decision support.

## Important terminology

Use these phrases:

- User-confirmed
- Unreviewed evidence
- Deterministic calculation
- Scenario assumption
- Text PDF extraction
- OCR is deferred for scanned PDFs
- Cash runway is the conservative cash-only view
- Working-capital-adjusted runway is a planning view with explicit assumptions

Avoid these claims:

- AI verified the values
- The model calculated the financial result
- All PDFs are automatically extracted
- AI-BOSS supports every Excel formula
- Scenarios update actual financial records
- Working-capital-adjusted runway is a formal accounting standard
- Accounting connectors are production-ready

## Recovery notes during recording

### Old values appear

- Delete earlier synthetic uploads or use a fresh account.
- Select `01-valid-nzd-history.csv` in the source filter.

### Chat still shows the preapproval answer

- This is expected for the old message.
- Ask the same question again to produce a new answer.

### Scenario baseline is missing

- Confirm the document is User-confirmed.
- Refresh the Scenarios page.
- Verify the source and NZD currency selector.

### Adjusted runway is unavailable

Verify that cash, receivables, payables, and burn share:

- the same document;
- the same currency; and
- the same reporting date.

### XLSX or PDF processing takes too long

- Pause the recording.
- Resume after processing completes.
- Remove the wait during editing.

### Chat response takes too long

- Leave one or two seconds of visible loading.
- Cut the remaining wait during editing.

### A browser development warning appears

- Do not open the developer console during the demonstration.
- The Safari development-mode hydration warning remains a separately deferred
  issue.

## Condensed 6–7 minute version

If the video must be shorter:

1. Keep the introduction under 30 seconds.
2. Briefly mention the Scenarios workspace but do not preview it initially.
3. Demonstrate the full CSV preapproval, correction, exclusion, and approval
   workflow.
4. Ask the cash question before and after approval.
5. Explain and show both runway measures.
6. Show the Runway chart with Both selected.
7. Run the hiring scenario but do not save it.
8. Mention XLSX and PDF support verbally without uploading both files.
9. End with the trust-boundary explanation.

Do not remove the before-approval and after-approval comparison. It is the
clearest demonstration of the Phase 4 trust model.

## Research notes supporting the runway explanation

The video should describe this as reviewing financial guidance, not as a formal
academic literature review.

- Stripe describes cash runway as cash balance divided by monthly net burn:
  <https://stripe.com/en-ca/resources/more/what-is-burn-rate-what-startups-need-to-know-about-this-key-metric>
- Business.govt.nz explains that available cash differs from accounts receivable
  that is still to be collected and accounts payable that is still to be paid:
  <https://www.business.govt.nz/strategy-and-performance/strategic-finance/understanding-your-cash-flow-statements>
- Business.govt.nz also discusses accounts receivable and accounts payable as
  important short-term financial inputs:
  <https://www.business.govt.nz/strategy-and-performance/strategic-finance/key-equations-for-your-finances>

The working-capital-adjusted runway formula is an explicit AI-BOSS planning
measure. It should not be presented as a universal accounting-standard ratio.
