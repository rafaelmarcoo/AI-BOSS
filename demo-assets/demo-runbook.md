# AI-BOSS Stakeholder Demo Runbook

Demo target: next stakeholder/supervisor demo after Sprint 2.

Audience: teammates, supervisors, and finance/accounting stakeholders.

## One-Line Positioning

AI-BOSS is an AI decision-support layer for finance teams. It does not replace
Xero, QuickBooks, or an accountant; it uses connected accounting data and
uploaded finance documents to answer source-aware questions, model scenarios,
and explain cash-flow risk before decisions become expensive.

## What Changed Since The Last Demo

- Sprint 2 is now merged into `main`.
- Xero OAuth/token storage is back on the mainline path.
- OAuth credential storage is provider-neutral through `oauth_tokens`.
- Generic `/api/integrations/*` and `/api/webhooks/[provider]` routes exist.
- Accounting adapter shapes exist for Xero, QuickBooks, FreshBooks, and MYOB.
- The visible stable demo remains Xero/demo mode plus CSV/PDF uploads.
- Dashboard/chat metrics now use source-aware `financial_metric_observations`.
- Chat can use latest metrics, scenario modelling, runway history, and rough
  runway trend tools.
- PDF uploads are available as RAG/evidence context.
- Demo assets and QA guardrails are in `demo-assets/`.

## Pre-Demo Setup

Run these before the meeting:

```bash
npx tsc --noEmit
npm test -- --runInBand
npm run lint
npm run build
npm run dev
```

Expected automated result on current `main`:

- TypeScript passes.
- Jest passes with 25 suites and 83 tests.
- ESLint passes.
- Production build passes.
- Dev server opens on `http://localhost:3000`.

Environment checks:

- `.env.local` has Supabase URL, anon key, and service role key.
- `.env.local` has `OPENAI_API_KEY` for chat, embeddings, and RAG quality.
- `.env.local` has `TOKEN_ENCRYPTION_KEY`.
- For a stable Xero visual demo, set `XERO_DEMO_MODE=true`.
- Local Xero callback env should be:
  - `NEXT_PUBLIC_APP_URL=http://localhost:3000`
  - `XERO_REDIRECT_URI=http://localhost:3000/api/xero/callback`

Database checks:

- Migration `007_drop_financial_snapshots.sql` has run.
- Migration `008_accounting_oauth_tokens.sql` has run.
- `oauth_tokens` exists for persistent encrypted provider credentials.
- `oauth_connection_states` exists for short-lived OAuth callback state.
- `financial_metric_observations` exists and is the metric source of truth.

## Demo Story

Use this framing:

> Accounting tools already show balances, invoices, and bills. AI-BOSS is the
> intelligence layer on top: it pulls from accounting data and finance documents,
> keeps sources visible, and lets users ask decision questions such as "Can we
> afford this hire?", "What changed?", or "What does this report say about cash
> risk?"

Stakeholder note from Daniel / Auckland City Mission:

> The strongest value is not another static dashboard. It is forecasting,
> scenario explanation, PDF/invoice analysis, cost-code/cost-centre insight, and
> answers that feel like an add-on to finance workflows users already know.

## Live Demo Flow

### 1. Sign In And Establish The Workspace

Click:

- Open `https://ai-boss-nine.vercel.app/`.
- Sign in.
- Go to Dashboard.

Say:

> I’ll start as a business owner or finance user. The app is authenticated, so
> each user sees their own dashboard, uploads, conversations, and decision
> context.

Show:

- Header/profile is loaded.
- Chat is on the left.
- Dashboard metrics are on the right.
- Documents drawer/upload control is available above the chat input.
- Conversation history can be opened, renamed, or deleted.

Expected:

- No auth loop.
- Dashboard loads without crashing.
- Empty or unavailable metrics are acceptable before upload.

### 2. Show Data Source Strategy

Click:

- Scroll to or point at "Connect data sources".
- Open the accounting provider dropdown.
- Show Xero, QuickBooks, FreshBooks, and MYOB options.

Say:

> Sprint 2 moved accounting credentials to a provider-neutral design. Xero is
> the stable visible demo path today, while QuickBooks, FreshBooks, and MYOB have
> backend adapter shapes and generic API routes ready for future hardening.

Expected in demo mode:

- Xero shows Connected.
- Demo chip appears.
- Disconnect is disabled in demo mode.

Expected outside demo mode:

- Xero shows Connected or Disconnected.
- Connect goes through `/api/xero/connect`.
- Callback writes credentials to `oauth_tokens`.

Avoid overclaiming:

> We are not claiming full live normalization across every accounting platform
> today. The Sprint 2 research baseline proves the provider-neutral integration
> shape, and the stable demo uses Xero state plus controlled CSV/PDF data.

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

> CSV is our deterministic structured metric path. The upload is parsed into
> `financial_metric_observations`, which powers dashboard cards, chat context,
> scenario tools, history, and source labels.

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
- Gives about `5.4 months`.
- Mentions the uploaded CSV/source label.
- Does not cite the PDF yet.

Ask:

```text
Which source is my cash balance coming from?
```

Expected answer:

- Says cash is from the uploaded full metrics CSV.
- Ideally includes about `120000 NZD`.

### 4. Demo Read-Only Scenario Modelling

Ask:

```text
What happens if monthly costs increase by 9000?
```

Expected answer:

- Treats this as a what-if scenario.
- Uses current structured runway inputs.
- Does not save the scenario as actual financial data.
- Explains the runway impact and policy/risk tone.

Ask:

```text
Could we afford to hire someone if that adds 9000 per month to expenses?
```

Expected answer:

- Models the added monthly cost.
- Warns about runway pressure if appropriate.
- Frames the response as decision support, not licensed financial advice.

Say:

> This is the part Daniel pushed us toward: the dashboard is useful, but the real
> value is asking business-decision questions before committing money.

### 5. Upload PDF Board Report For RAG Evidence

Upload:

`demo-assets/ai-boss-demo-board-report.pdf`

Click:

- Upload through the chat upload icon.
- Open Documents drawer.
- Wait until the PDF shows Ready.

Say:

> PDFs are evidence context. They help AI-BOSS answer questions about uploaded
> board reports or invoices, but they do not become dashboard calculations unless
> a confirmed structured extraction flow writes metrics into
> `financial_metric_observations`.

Ask:

```text
What does the uploaded board report say about cash risk and next actions?
```

Expected answer:

- Summarises relevant report evidence.
- Mentions cash pressure/risk and next actions.
- Does not claim the PDF changed dashboard metrics.

Optional stakeholder framing:

> This is a stepping stone toward the invoice/PDF analysis Daniel suggested:
> upload finance documents, ask targeted questions, and reduce manual digging
> through files.

### 6. Upload Partial Updated Month CSV

Upload:

`demo-assets/ai-boss-demo-updated-month.csv`

Say:

> This file is intentionally partial. It updates cash, revenue, expenses, and
> burn, but omits AR, AP, and runway. That lets us prove source mixing: latest
> observation per metric wins, while missing metrics keep their previous source.

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

- Identifies updated metrics.
- Identifies older-source metrics.
- Does not pretend every metric came from the latest file.

### 7. Upload Risky Month CSV

Upload:

`demo-assets/ai-boss-demo-risky-month.csv`

Say:

> This later month lowers cash and increases burn. It creates a clean decline
> for runway history, rough trend forecasting, and risk-warning tests.

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

- Uses historical runway observations.
- Says runway is declining.
- References the uploaded CSV sequence or source labels.

Ask:

```text
If this runway trend continues, when do I hit a risky point?
```

Expected answer:

- Uses the rough runway trend tool/context.
- Says this is a continuation estimate, not a true prediction.
- Warns that current runway is already risky or near risky.

### 8. Demo Markdown Rendering

Ask:

```text
Give me a short action plan in Markdown with three bullet points and one bold warning.
```

Expected answer:

- Bullets render as bullets.
- Bold text renders as bold.
- Assistant message does not show awkward raw Markdown.

### 9. Dashboard-To-Chat Selection Prompt

Click:

- Highlight text in the runway summary prompt near the top of the dashboard.
- Click `Ask chatbot`.

Say:

> This links dashboard exploration to chat. A user can select a dashboard
> insight and send it straight into AI-BOSS for explanation.

Expected:

- The selected summary is sent to chat.
- Chat responds to the selected dashboard context.

## Strong Backup Questions

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

```text
What information would you need to forecast cash flow by department or cost centre?
```

```text
If I uploaded invoices by cost code, what questions could AI-BOSS help answer?
```

## Product Rules To Say Out Loud

- AI-BOSS is an intelligence layer, not a replacement ledger.
- CSV files feed structured financial metrics.
- PDF files feed RAG/evidence context only.
- Dashboard calculations come from `financial_metric_observations`, not raw chunks.
- Chat should prefer structured metrics for calculations and use document chunks
  as supporting context.
- Scenario modelling is read-only and does not save results as actuals.
- Forecast/trend output is rough decision support, not a formal prediction.
- Accounting OAuth credentials use provider-neutral `oauth_tokens`.
- `oauth_connection_states` is temporary callback state only.

## Known Limitations To Say Clearly

- Live Xero normalization still depends on useful tenant/test data.
- QuickBooks/FreshBooks/MYOB are backend-shaped but not the stable visible demo.
- CSV extraction is deterministic and label/header based.
- PDF files are evidence context, not confirmed structured metric sources.
- There is no saved scenario workspace yet.
- Cost-centre/cost-code modelling is next-sprint research work.
- Forecasting needs richer historical or synthetic data before serious evaluation.
- AI-BOSS is not licensed financial advice; it supports decisions and should
  recommend professional review for major commitments.

## If Something Breaks

- If Xero is awkward: say demo mode is intentional and move to CSV upload.
- If provider dropdown status fails: say generic integrations are backend-shaped,
  then demo the stable Xero/upload path.
- If upload processing takes time: explain the pipeline: document record,
  parsing, chunks/embeddings, deterministic CSV extraction, observation storage,
  dashboard refresh.
- If PDF retrieval is slow or weak: say RAG quality depends on `OPENAI_API_KEY`
  and embeddings, then ask a structured metric question.
- If chat fails: show dashboard metrics, source labels, and the passing test/build
  output.
- If source mixing looks surprising: explain latest observation per metric wins,
  and missing metrics stay on their previous source.

## Final Reset Before The Room Arrives

- Use a fresh user, or clear old demo documents for clean source labels.
- Upload order is full metrics, PDF, updated month, risky month.
- Keep `demo-assets/` open in Finder.
- Keep terminal showing recent passing checks if useful.
- Have the Daniel/Auckland City Mission takeaway ready:
  - "Do not duplicate Xero."
  - "Focus on forecasting, scenarios, invoice/PDF analysis, and cost centres."
  - "Use synthetic structured finance data next semester to test this properly."
