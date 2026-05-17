# AI-BOSS Stakeholder Demo Runbook

Demo date: Monday 18 May 2026

Audience: teammates, supervisors, and Auckland City Mission accountant.

## One-Line Positioning

AI-BOSS helps SMEs turn accounting data and uploaded finance documents into source-aware metrics, runway insight, and explainable chat guidance before decisions become expensive.

## Setup Checklist

- Pull latest `main`.
- Confirm `.env.local` has Supabase keys, `OPENAI_API_KEY`, `TOKEN_ENCRYPTION_KEY`, and `XERO_DEMO_MODE=true` if using demo Xero state.
- Run `npm run dev`.
- Sign in before the meeting.
- Keep this folder open: `demo-assets/`.
- Use a fresh user or clear old demo documents if you want clean source labels.

## Slide-To-Demo Flow

Use slides 1-7 only, then move into the live product.

1. Slide 1: Introduce AI-BOSS as privacy-first SME financial decision support.
2. Slide 2: Emphasise the problem: accounting tools show history, but owners need decision support.
3. Slide 3: State MVP scope: Xero/CSV data, deterministic metrics, scenario questions, explainable chat, audit logging.
4. Slide 4: Explain novelty: not replacing Xero; adding simulation, guardrails, citations, and chat reasoning.
5. Slide 5: Architecture: LLM orchestrates, deterministic tools calculate, Supabase stores user-owned data.
6. Slide 6: Team delivery: Rafael foundation/data/chat, Kaiden dashboard/chat UI, Hamza connectors, shared testing and workflow.
7. Slide 7: Timeline: Sprint 2 now has working ingestion, metrics, RAG, and chat context; scenario/policy depth comes next.

## Live Demo Steps

### 1. Sign-In And Dashboard

Say:

> I’ll start as a business owner. The app is authenticated, so each user sees their own dashboard, documents, conversations, and decision logs.

Show:

- Sign in.
- Dashboard layout.
- Xero data connector state.
- Chat panel on the left and dashboard metrics on the right.

### 2. Xero Connection State

Say:

> We have the OAuth connection foundation in place. For today we are using demo mode because we do not yet have a real test tenant with useful accounting data.

Show:

- Xero status card.
- Connect/disconnect/demo state if visible.

Avoid overclaiming:

> The important part here is stable connection state and token handling. Full Xero normalisation is deliberately parked until we have real tenant data.

### 3. CSV Upload To Structured Metrics

Upload:

`demo-assets/ai-boss-demo-full-metrics.csv`

Say:

> CSV uploads are currently the deterministic structured metric path. The app extracts known financial labels into `financial_metric_observations`, which powers the dashboard and chat calculations.

Show:

- Upload through the chat document button.
- Wait for processing.
- Dashboard refreshes with cash, AR, AP, revenue, expenses, burn, and runway.
- Point out source labels on metric cards.

Ask chat:

```text
What is my runway and what source did you use?
```

Expected:

- Chat uses structured metrics.
- Mentions uploaded CSV source naturally.
- Explains runway in plain language.

### 4. Scenario Modelling Through Chat

Ask:

```text
What happens to runway if monthly burn increases to 40000?
```

Say:

> This is our first lightweight scenario modelling path. The agent uses the current structured metrics, changes the scenario input, and calls the deterministic runway calculation tool.

Expected:

- Runway should drop from the baseline.
- Chat should explain that this is a what-if scenario, not a stored actual metric.

Follow-up:

```text
Could we afford to hire someone if that adds 9000 per month to expenses?
```

### 5. PDF Upload As RAG Evidence

Upload:

`demo-assets/ai-boss-demo-board-report.pdf`

Say:

> PDFs are intentionally treated as RAG evidence. They help chat answer questions about uploaded reports, but they do not become canonical dashboard metrics unless a future extraction step writes confirmed values into the metric observation table.

Ask:

```text
What does the uploaded board report say about cash risk and next actions?
```

Expected:

- Chat summarises relevant PDF evidence.
- Chat should not imply the PDF alone changed dashboard metrics.

### 6. Partial New CSV And Source Mixing

Upload:

`demo-assets/ai-boss-demo-updated-month.csv`

Say:

> This newer file only contains some metrics. Current behaviour is latest observation per metric wins, so updated values can mix with older values for missing metrics. That is intentional for now, and source selection/deduplication is a future UX card.

Ask:

```text
What changed after the newer upload, and which metrics are still coming from an older source?
```

Expected:

- Cash, revenue, expenses, burn update.
- AR/AP/runway may remain older if not supplied by the newer CSV.
- Chat should be transparent about source mixing.

### 7. Generative UI Selection Prompt

Show:

- Highlight the runway summary text in the dashboard insight card.
- Click `Ask chatbot`.

Say:

> Kaiden’s latest branch adds a dashboard-to-chat interaction. The user can select a dashboard insight and send it straight into the chat flow, so dashboard exploration and agent reasoning feel connected.

Expected:

- Chat receives a prompt asking it to explain the selected dashboard highlight.

## Stakeholder Questions To Invite

- Which accounting systems matter most to Auckland City Mission workflows?
- Would CSV upload be useful as an interim import path?
- What metrics should be treated as must-have for cash-flow decision support?
- What financial policies or thresholds should AI-BOSS check before giving advice?
- What would make a recommendation trustworthy: source labels, formulas, audit logs, citations, or approval steps?
- For privacy, what data should never be sent to an LLM?

## Known Limitations To Say Clearly

- Xero connection state is working, but deep Xero data normalisation is deferred until we have better test data.
- CSV metric extraction is deterministic and label/header based, not arbitrary spreadsheet understanding.
- PDFs are RAG evidence only, not structured dashboard metric sources.
- Scenario modelling is currently chat/tool based, not yet a saved scenario workspace.
- Policy enforcement is in the architecture and schema, but not yet fully implemented as a product workflow.

## If Something Breaks

- If Xero is awkward: say demo mode is intentional and move to CSV upload.
- If PDF retrieval is slow: ask a CSV/metric question and explain embeddings need `OPENAI_API_KEY`.
- If chat fails: show dashboard source-aware metrics and automated tests.
- If upload processing takes time: talk through the pipeline: document record, chunking, embeddings, metric extraction, observation storage, dashboard refresh.
