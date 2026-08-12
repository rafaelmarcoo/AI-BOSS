# AI-BOSS End-To-End QA Checklist

Use this checklist before the stakeholder demo. Mark each item manually while testing the local app.

## 1. Environment And Build

- [ ] `git status --short` has only intentional changes.
- [ ] `.env.local` has Supabase URL, anon key, and service role key.
- [ ] `.env.local` has `OPENAI_API_KEY`.
- [ ] `.env.local` has `TOKEN_ENCRYPTION_KEY`.
- [ ] If using demo Xero, `.env.local` has `XERO_DEMO_MODE=true`.
- [ ] Local Xero env is `NEXT_PUBLIC_APP_URL=http://localhost:3000`.
- [ ] Local Xero env is `XERO_REDIRECT_URI=http://localhost:3000/api/xero/callback`.
- [ ] `npx tsc --noEmit` passes.
- [ ] `npm test -- --runInBand` passes.
- [ ] `npm run build` passes.
- [ ] `npm run dev` starts the app.

Expected:

- Typecheck passes.
- Jest passes with 21 suites and 77 tests.
- Build includes `/api/integrations/*`, `/api/webhooks/[provider]`, and `/api/xero/*`.

## 2. Database Migration And Schema

- [ ] `008_accounting_oauth_tokens.sql` has run successfully.
- [ ] `oauth_tokens` exists.
- [ ] `oauth_tokens` has policies for select, insert, update, and delete.
- [ ] `oauth_connection_states` still exists.
- [ ] `xero_connections` no longer exists after migration.
- [ ] `financial_snapshots` no longer exists after migration `007`.
- [ ] `financial_metric_observations` exists.

Expected:

- `oauth_connection_states` stores temporary OAuth state only.
- `oauth_tokens` stores encrypted persistent provider credentials.
- `financial_metric_observations` remains the dashboard/chat/tool source of truth.

## 3. Auth Flow

- [ ] Open `http://localhost:3000`.
- [ ] Sign up or sign in.
- [ ] Dashboard loads.
- [ ] Sign out.
- [ ] Sign in again.

Expected:

- Auth cookies are set.
- Dashboard redirects unauthenticated users to sign-in.
- Signed-in users can return to dashboard.

## 4. Xero Connection State

- [ ] With `XERO_DEMO_MODE=true`, dashboard shows Xero Connected.
- [ ] Demo chip appears.
- [ ] Disconnect is disabled in demo mode.
- [ ] With demo mode off, disconnected state appears if no connection exists.
- [ ] `/api/xero/status` returns a stable JSON response.

Expected:

- Existing Xero UI still works even though credentials now use `oauth_tokens`.
- No UI references `oauth_tokens`; that is an implementation detail.

## 5. Provider-Neutral Integration APIs

Manual API smoke checks:

- [ ] `GET /api/integrations/status` returns provider entries for Xero, QuickBooks, FreshBooks, and MYOB for an authenticated user.
- [ ] Unsupported provider routes return a validation error rather than crashing.
- [ ] No debug integration route exists.
- [ ] No background auto-sync watcher runs in the UI.

Expected:

- The generic backend routes exist, but the visible demo remains stable through Xero plus uploads.

## 6. CSV Upload: Baseline Metrics

Upload:

`demo-assets/ai-boss-demo-full-metrics.csv`

Expected document state:

- Document appears in the Documents drawer.
- Status moves to Ready.

Expected dashboard values:

- [ ] Cash: `$120,000`
- [ ] Accounts receivable: `$45,000`
- [ ] Accounts payable: `$21,000`
- [ ] Monthly revenue: `$80,000`
- [ ] Monthly expenses: `$52,000`
- [ ] Monthly burn: `$28,000`
- [ ] Runway: `5.4 months`

Ask:

```text
What is my runway and what source did you use?
```

Expected:

- Answer uses structured metrics.
- Answer mentions the CSV source.
- Answer gives about `5.4 months`.

## 7. PDF Upload: RAG Evidence Only

Upload:

`demo-assets/ai-boss-demo-board-report.pdf`

Expected:

- PDF appears in Documents drawer.
- Status moves to Ready.
- Dashboard metrics do not change because PDFs are RAG-only.

Ask:

```text
What does the uploaded board report say about cash risk and next actions?
```

Expected:

- Answer summarises board-report content.
- Answer does not claim the PDF changed dashboard metrics.
- Answer can reference report evidence/context.

## 8. CSV Upload: Source Mixing

Upload:

`demo-assets/ai-boss-demo-updated-month.csv`

Expected dashboard/source behavior:

- [ ] Cash: `$95,000` from updated month CSV.
- [ ] Monthly revenue: `$72,000` from updated month CSV.
- [ ] Monthly expenses: `$61,000` from updated month CSV.
- [ ] Monthly burn: `$34,000` from updated month CSV.
- [ ] AR remains `$45,000` from full metrics CSV.
- [ ] AP remains `$21,000` from full metrics CSV.
- [ ] Runway remains `5.4 months` from full metrics CSV.

Ask:

```text
What changed after the newer upload, and which metrics are still coming from an older source?
```

Expected:

- Answer explains source mixing.
- Answer does not imply the newer partial CSV supplied every metric.

## 9. CSV Upload: Risky Month

Upload:

`demo-assets/ai-boss-demo-risky-month.csv`

Expected dashboard values:

- [ ] Cash: `$52,000`
- [ ] Accounts receivable: `$18,000`
- [ ] Accounts payable: `$27,000`
- [ ] Monthly revenue: `$58,000`
- [ ] Monthly expenses: `$76,000`
- [ ] Monthly burn: `$42,000`
- [ ] Runway: `1.0 month`

Ask:

```text
Is my runway improving or declining over time?
```

Expected:

- Answer says runway is declining.
- Answer uses historical observations rather than PDF chunks.

Ask:

```text
If this runway trend continues, when do I hit a risky point?
```

Expected:

- Answer gives a rough continuation estimate.
- Answer clarifies this is not a true prediction.
- Answer warns the current state is already risky or near risky.

## 10. Scenario Modelling

Ask after baseline or risky metrics:

```text
What happens if monthly costs increase by 9000?
```

```text
Could we afford to hire someone if that adds 9000 per month to expenses?
```

Expected:

- Answer uses scenario/tool logic.
- Answer clearly labels the result as a what-if.
- No new actual metric is saved from the scenario.

## 11. Markdown Rendering

Ask:

```text
Give me a short action plan in Markdown with three bullet points and one bold warning.
```

Expected:

- Bullets render correctly.
- Bold text renders correctly.
- Assistant response is readable, not raw unstyled Markdown.

## 12. Dashboard-To-Chat Selection

- [ ] Highlight the runway summary text.
- [ ] Click `Ask chatbot`.

Expected:

- Chat receives a prompt about the highlighted dashboard insight.
- Chat responds in the current conversation.

## 13. Conversation Sidebar

- [ ] Send a first chat message.
- [ ] Conversation appears in sidebar.
- [ ] Rename the conversation.
- [ ] Start or select another conversation.
- [ ] Delete a disposable conversation.

Expected:

- Sidebar updates without page-load chat resets.
- Titles are readable.
- Delete does not affect uploaded metric observations.

## 14. Negative Tests

- [ ] Upload a non-PDF/non-CSV file and confirm it is rejected.
- [ ] Ask a metric question before uploading data and confirm AI-BOSS does not invent values.
- [ ] Ask “Which metrics are unavailable?” before and after uploads.
- [ ] Disconnect Xero outside demo mode and confirm status changes.
- [ ] Refresh dashboard after uploads and confirm latest metrics persist.

Expected:

- Failures are graceful.
- Missing metrics are described as unavailable.
- Existing uploaded metrics survive refresh.

## 15. Final Demo Reset

Before the real demo:

- [ ] Use a fresh user, or clear old demo documents for clean source labels.
- [ ] Upload order is full metrics, PDF, updated month, risky month.
- [ ] Keep this folder open.
- [ ] Keep terminal showing recent passing tests if useful.
