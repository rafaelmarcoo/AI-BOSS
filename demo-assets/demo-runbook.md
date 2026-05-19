# AI-BOSS Stakeholder Demo Runbook

Demo date: Monday 18 May 2026

Audience: teammates, supervisors, and Auckland City Mission accountant.

## One-Line Positioning

AI-BOSS helps SMEs turn accounting data and uploaded finance documents into source-aware metrics, runway insight, and explainable chat guidance before decisions become expensive.

## Pre-Demo Setup

Run these before the meeting:

```bash
npx tsc --noEmit
npm test -- --runInBand
npm run build
npm run dev
```

Expected automated result:

- TypeScript passes.
- Jest passes with 21 suites and 77 tests.
- Production build passes.
- Dev server opens on `http://localhost:3000`.

Environment checks:

- `.env.local` has Supabase keys.
- `.env.local` has `OPENAI_API_KEY` for embeddings/RAG/chat quality.
- `.env.local` has `TOKEN_ENCRYPTION_KEY`.
- For demo Xero state, set `XERO_DEMO_MODE=true`.
- Local Xero callback env should be:
  - `NEXT_PUBLIC_APP_URL=http://localhost:3000`
  - `XERO_REDIRECT_URI=http://localhost:3000/api/xero/callback`

Database checks:

- Migration `007_drop_financial_snapshots.sql` has run.
- Migration `008_accounting_oauth_tokens.sql` has run.
- `oauth_tokens` exists.
- `xero_connections` is dropped after migration.
- `oauth_connection_states` still exists because it is temporary OAuth callback state.

## Demo Story

Use this story:

> AI-BOSS is not trying to replace Xero or an accountant. It sits on top of accounting data and finance documents, turns them into source-aware metrics, and lets a business owner ask decision questions before cash-flow problems become urgent.

## Live Demo Steps

### 1. Sign In And Show The Dashboard

Click:

- Open `http://localhost:3000`.
- Sign in.
- Go to Dashboard.

Say:

> I’ll start as a business owner. The app is authenticated, so each user sees their own dashboard, uploads, conversations, and decision context.

Show:

- Header/profile is loaded.
- Chat is on the left.
- Dashboard metrics are on the right.
- Documents drawer exists above the chat input.

Expected:

- No auth loop.
- Dashboard loads without crashing.
- Empty or unavailable metrics are allowed before upload.

### 2. Show Xero Connection State

Click:

- Look at the Xero card in Connect data sources.

Say:

> The Xero OAuth foundation is in place. We recently moved stored OAuth credentials to a provider-neutral `oauth_tokens` table, while `oauth_connection_states` remains only the short-lived callback state. For this demo we can use Xero demo mode instead of relying on a real tenant.

Expected in demo mode:

- Xero card shows Connected.
- Demo chip appears.
- Disconnect button is disabled in demo mode.

Expected outside demo mode:

- Xero card shows Connected or Disconnected.
- Connect goes through `/api/xero/connect`.
- Callback writes credentials to `oauth_tokens`.

Avoid overclaiming:

> The provider-neutral backend now supports the shape for Xero, QuickBooks, FreshBooks, and MYOB, but today’s visible stable demo remains Xero plus CSV/PDF ingestion.

### 3. Upload Baseline CSV Metrics

Upload:

`demo-assets/ai-boss-demo-full-metrics.csv`

Click:

- Click the upload icon in chat.
- Select the CSV.
- Open the Documents drawer.
- Wait until the document shows Ready.
- Refresh dashboard if needed.

Say:

> CSV upload is the deterministic structured metric path. The app extracts known financial labels into `financial_metric_observations`, and that table powers dashboard metrics, chat math, tools, history, and forecasts.

Expected dashboard values:

- Cash: `$120,000`
- Accounts receivable: `$45,000`
- Accounts payable: `$21,000`
- Monthly revenue: `$80,000`
- Monthly expenses: `$52,000`
- Monthly burn: `$28,000`
- Runway: `5.4 months`

Ask:

```text
What is my runway and what source did you use?
```

Expected answer:

- Uses structured metrics.
- Says runway is about `5.4 months`.
- Mentions the uploaded CSV/source label.
- Does not cite the PDF because it has not been uploaded yet.

Ask:

```text
Which source is my cash balance coming from?
```

Expected answer:

- Says cash balance is from the uploaded full metrics CSV.
- Ideally includes the amount `120000 NZD`.

### 4. Demo Scenario Modelling

Ask:

```text
What happens if monthly costs increase by 9000?
```

Expected answer:

- Treats this as a what-if scenario.
- Uses current structured cash/burn inputs.
- Does not save the scenario as an actual metric.
- Explains runway gets worse.

Ask:

```text
Could we afford to hire someone if that adds 9000 per month to expenses?
```

Expected answer:

- Calculates or estimates the impact.
- Warns about runway pressure.
- Frames it as decision support, not financial advice.

Say:

> Scenario modelling is read-only. It helps the owner understand tradeoffs without contaminating actual uploaded metrics.

### 5. Upload PDF Board Report For RAG

Upload:

`demo-assets/ai-boss-demo-board-report.pdf`

Click:

- Upload through the chat upload icon.
- Open Documents drawer.
- Wait until the PDF shows Ready.

Say:

> PDFs are intentionally RAG evidence only. They help chat answer questions about uploaded reports, but they do not become dashboard calculations unless a future extraction flow writes confirmed values into `financial_metric_observations`.

Ask:

```text
What does the uploaded board report say about cash risk and next actions?
```

Expected answer:

- Summarises relevant board-report context.
- Mentions cash risk and next actions.
- Uses document context as evidence.
- Does not claim the PDF changed dashboard metrics.

### 6. Upload Partial Updated Month CSV

Upload:

`demo-assets/ai-boss-demo-updated-month.csv`

Say:

> This file is intentionally partial. It updates cash, revenue, expenses, and burn, but omits AR, AP, and runway. That lets us test source mixing transparently.

Expected dashboard/source behavior:

- Cash updates to `$95,000`.
- Monthly revenue updates to `$72,000`.
- Monthly expenses updates to `$61,000`.
- Monthly burn updates to `$34,000`.
- AR remains `$45,000` from the older full metrics CSV.
- AP remains `$21,000` from the older full metrics CSV.
- Runway remains `5.4 months` from the older full metrics CSV.

Ask:

```text
What changed after the newer upload, and which metrics are still coming from an older source?
```

Expected answer:

- Identifies the newer metrics.
- Identifies AR/AP/runway as older-source metrics.
- Does not pretend every metric came from the latest file.

Ask:

```text
Which metrics are unavailable?
```

Expected answer:

- After this upload sequence, ideally says core metrics are available.
- If it lists unavailable metrics, it should not invent values.

### 7. Upload Risky Month CSV

Upload:

`demo-assets/ai-boss-demo-risky-month.csv`

Say:

> Now I’ll upload a later month where cash has fallen and burn has increased. This creates a clean runway decline for history, forecast, and policy-warning tests.

Expected dashboard values:

- Cash: `$52,000`
- Accounts receivable: `$18,000`
- Accounts payable: `$27,000`
- Monthly revenue: `$58,000`
- Monthly expenses: `$76,000`
- Monthly burn: `$42,000`
- Runway: `1.0 month`

Ask:

```text
Is my runway improving or declining over time?
```

Expected answer:

- Uses historical observations.
- Says runway is declining from baseline to risky month.
- References the uploaded CSV sequence.

Ask:

```text
If this runway trend continues, when do I hit a risky point?
```

Expected answer:

- Uses forecast runway trend tool/context.
- Clearly says it is a rough continuation estimate, not a real prediction.
- Warns that current runway is already risky or near risky.

### 8. Demo Markdown Rendering

Ask:

```text
Give me a short action plan in Markdown with three bullet points and one bold warning.
```

Expected answer:

- Bullets render as bullets.
- Bold text renders as bold.
- Assistant message does not show raw Markdown awkwardly.

### 9. Dashboard-To-Chat Selection Prompt

Click:

- Highlight text in the runway summary prompt near the top of the dashboard.
- Click `Ask chatbot`.

Say:

> This links dashboard exploration to chat. A user can select a dashboard insight and send it straight into AI-BOSS for explanation.

Expected:

- The selected summary is sent to chat.
- Chat responds to the selected dashboard context.

## Backup Questions

Use these if the room asks for more:

```text
Explain which numbers came from CSV and which came from the uploaded PDF.
```

```text
What would you ask my accountant before I make a hiring decision?
```

```text
What are the biggest cash risks in my current data?
```

```text
What source did you use for monthly burn?
```

```text
Can you show the formula behind the runway estimate?
```

## Known Limitations To Say Clearly

- Xero connection state and token storage are implemented, but live Xero normalization depends on useful tenant data.
- QuickBooks/FreshBooks/MYOB are backend-shaped but not the main visible demo path.
- CSV extraction is deterministic and label/header based.
- PDF files are RAG evidence only.
- Dashboard calculations come from `financial_metric_observations`, not raw chunks.
- Scenario modelling is chat/tool based, not a saved scenario workspace.
- Forecast trend is a rough continuation estimate.

## If Something Breaks

- If Xero is awkward: say demo mode is intentional and move to CSV upload.
- If PDF retrieval is slow or weak: say embeddings/RAG need `OPENAI_API_KEY`, then ask a structured metric question.
- If chat fails: show dashboard metrics and the automated test result.
- If upload processing takes time: explain the pipeline: document record, parsing, chunks/embeddings, deterministic CSV extraction, observation storage, dashboard refresh.
- If source mixing looks surprising: explain latest observation per metric wins, and missing metrics stay on their previous source.
