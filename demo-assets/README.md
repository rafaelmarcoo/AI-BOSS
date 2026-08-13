# AI-BOSS Demo Assets

Use this folder as the single source of truth for the live demo flow and QA pass.

## Files

- `demo-runbook.md` - live stakeholder demo script with what to say, click, upload, ask, and expect.
- `qa-checklist.md` - broader end-to-end test checklist for the repo before demo.
- `ai-boss-demo-full-metrics.csv` - baseline structured metrics.
- `ai-boss-demo-updated-month.csv` - partial newer month that proves source mixing.
- `ai-boss-demo-risky-month.csv` - urgent low-runway month that proves warnings, trends, and forecast behavior.
- `ai-boss-demo-consistent.csv` - three dated, same-currency months for multi-agent history, forecast, and scenario testing.
- `ai-boss-demo-board-report.pdf` - PDF-only board report for RAG evidence.

## Upload Order

1. Upload `ai-boss-demo-full-metrics.csv`.
2. Upload `ai-boss-demo-board-report.pdf`.
3. Upload `ai-boss-demo-updated-month.csv`.
4. Upload `ai-boss-demo-risky-month.csv`.

## Expected Structured Metric Values

After `ai-boss-demo-full-metrics.csv`:

- Cash: `120000 NZD`
- Accounts receivable: `45000 NZD`
- Accounts payable: `21000 NZD`
- Monthly revenue: `80000 NZD`
- Monthly expenses: `52000 NZD`
- Monthly burn: `28000 NZD`
- Runway: `5.4 months`

After `ai-boss-demo-updated-month.csv`:

- Cash should update to `95000 NZD`.
- Revenue should update to `72000 NZD`.
- Expenses should update to `61000 NZD`.
- Burn should update to `34000 NZD`.
- AR/AP should still come from the older full metrics CSV.
- Runway should still come from the older full metrics CSV because this file intentionally omits runway.

After `ai-boss-demo-risky-month.csv`:

- Cash should update to `52000 NZD`.
- AR should update to `18000 NZD`.
- AP should update to `27000 NZD`.
- Revenue should update to `58000 NZD`.
- Expenses should update to `76000 NZD`.
- Burn should update to `42000 NZD`.
- Runway should update to `1.0 month`.

## Must-Ask Demo Questions

```text
What is my runway and what source did you use?
```

```text
Which source is my cash balance coming from?
```

```text
What happens if monthly costs increase by 9000?
```

```text
Could we afford to hire someone if that adds 9000 per month to expenses?
```

```text
What does the uploaded board report say about cash risk and next actions?
```

```text
What changed after the newer upload, and which metrics are still coming from an older source?
```

```text
Is my runway improving or declining over time?
```

```text
If this runway trend continues, when do I hit a risky point?
```

```text
Which metrics are unavailable?
```

## Product Rules To Say Out Loud

- CSV files feed structured financial metrics.
- PDF files always feed RAG/evidence context. Clearly dated PDFs with recognised financial labels can also create low-confidence structured observations; undated PDFs remain document-only.
- Dashboard calculations never come directly from raw chunks.
- Chat should prefer structured metrics for calculations and use document chunks as supporting context.
- Scenario modelling is read-only and should not save results.
- Forecast trend is a deterministic continuation estimate, not a guaranteed prediction.
- Accounting OAuth credentials now use provider-neutral `oauth_tokens`; `oauth_connection_states` is still only temporary callback state.
