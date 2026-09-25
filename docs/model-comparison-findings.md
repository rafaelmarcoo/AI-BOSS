# Model comparison — findings

**Card:** GLM vs GPT-4o vs Claude comparison
**Date:** 20 August 2026
**Raw results:** [`model-comparison.md`](./model-comparison.md), regenerate with `npm run compare:models`

This document holds the conclusions. The results file is generated and is
overwritten on every run, so nothing hand-written belongs in it.

---

## What was tested

Eight models across five providers, eight questions each — 64 runs. Every run
went through the real multi-agent path, so routing, specialist prompts and tool
calls are all included rather than testing the models in isolation.

| Provider | Models |
|---|---|
| OpenAI | GPT-4o mini, GPT-4o |
| Zhipu (z.ai) | GLM-5.2, GLM-5.3, GLM-5 Turbo |
| DeepSeek | DeepSeek V4 Flash |
| xAI | Grok 4 |
| Google | Gemini 3.6 Flash |

**Claude was not tested.** Anthropic has no OpenAI-compatible endpoint. The
architecture supports adding it — `ModelProvider.sdk` and the branch in
`buildModel` already handle non-OpenAI providers for Google — and doing so is
roughly 20 lines plus an API key. It was skipped because eight models across
five providers already cover the question and it meant a fifth billing account.

### How the questions were chosen

The first question set did not work. Every model answered "what is my runway?"
almost identically, because the arithmetic happens in `calculateRunway()` — the
model only reads a tool result and writes a sentence around it. Comparing models
on a task none of them can fail measures nothing.

The set was rebuilt on two principles:

**Coverage** — all three specialists and all five tools are exercised.

**Discrimination** — every question targets somewhere models can plausibly
diverge: refusing when data is absent, choosing tool arguments, and resolving a
question with no noun in it. One question (`runway`) is a deliberate control: it
should be near-identical everywhere, so a difference there indicates a broken
harness rather than a model difference.

That principle proved itself. The first six questions never touched the
`historical_forecast` specialist. Adding two that did immediately surfaced a
failure the other six had missed.

---

## Findings

### 1. No model fabricated a number it did not have

Two questions ask for ratios the system cannot compute — current ratio and gross
margin — because current assets, current liabilities and cost of sales are not
stored.

**All eight models refused, in all 16 cases.** None substituted
`(cash + receivables) ÷ payables` and presented it as a current ratio, which is
the plausible-looking wrong answer available to them.

This is the most important result for a financial tool, and it is a property of
the tool and prompt design rather than of any particular model.

Refusal *quality* did vary. GLM named the specific missing line items —
inventory, short-term debt, accrued expenses. Grok gave one terse sentence.
GPT-4o mini deflected to "consult a financial advisor". All are correct; GLM's
is the most useful.

### 2. Latency varies fivefold on identical work

| Model | Avg latency | Avg tokens |
|---|---|---|
| GPT-4o mini | 3.1s | 2,027 |
| GPT-4o | 3.3s | 2,178 |
| DeepSeek V4 Flash | 6.1s | 3,447 |
| Grok 4 | 6.1s | 3,355 |
| Gemini 3.6 Flash | 7.3s | 4,071 |
| GLM-5.2 | 8.6s | 3,085 |
| GLM-5.3 | 12.9s | 3,183 |
| GLM-5 Turbo | 15.9s | 3,918 |

For an interactive tool this is the difference between usable and abandoned.

**"Turbo" is the slowest GLM tier and uses the most tokens of any model.** The
name implies the opposite. Worth knowing before selecting it on cost grounds.

### 3. Two GLM versions fail on restrictive tool schemas

GLM-5.2 and GLM-5.3 fail both historical questions. `get_financial_history`
accepts only four values for `recordLimit` — `12`, `25`, `50` or `'all'` — and
they send something outside that set, most likely echoing "6 months" from the
question. The tool rejects it and the answer errors.

Six models stay inside the enum. **GLM-5 Turbo passes**, so this is
version-specific rather than provider-wide.

This is as much a schema observation as a model one. A union of three arbitrary
numbers plus a string literal is an unusual contract to hand a language model;
`z.number().int().min(1).max(100)` would accept 6 and behave sensibly. The
strictness buys little and costs compatibility with two models.

**Practical consequence:** avoid GLM-5.2 or GLM-5.3 on the `historical_forecast`
specialist. Both are fine on the other two, and GLM-5 Turbo is fine on all three.
The failure is loud — an error, not a wrong answer.

**Important caveat — this result is branch-specific.** These runs were made on
`model-comparsion`, which was three commits behind `main`. `main` has since
gained `toolInputRepairResult` in `lib/ai/agent.ts`: when a tool input fails
schema validation it returns a message asking the model to correct the arguments
and call the tool again, rather than failing the run.

That is a plausible fix for this exact failure — GLM would be told its
`recordLimit` was invalid and could retry with an accepted value. **The
underlying model behaviour still stands: GLM-5.2 and GLM-5.3 send arguments
outside a declared enum where six other models do not.** What changes is the
consequence — a hard failure here, likely a recovered retry on `main`.

This should be re-run after the branches are merged. Until then, treat the
4 failures as "these models produce invalid tool arguments", not as "these
models cannot answer historical questions".

### 4. OpenAI compatibility is a floor, not a guarantee

Seven of eight models run through one client with a different base URL, because
most providers implement OpenAI's API format. Gemini needed two separate fixes,
and neither was discoverable from documentation:

**It cannot use the OpenAI compatibility endpoint for tool calling.** Gemini 3
returns a proprietary `thought_signature` and requires it echoed back on the next
turn. That field has no place in the OpenAI schema, so an OpenAI client discards
it. Turn one succeeds, turn two fails. Verified directly — same request with the
field preserved returned 200, with it stripped returned 400. Fixed by using
Google's own SDK.

**It rejects JSON Schema keywords that Zod emits.** `z.number().positive()`
compiles to `exclusiveMinimum`, which Google refuses outright. Tools bound for
Gemini have those keywords stripped, at the cost of Google no longer seeing the
constraint — Zod still enforces it in the handler, so the guardrail is one layer
later for that provider only.

**The generalisable point:** a single-turn connectivity check is not evidence a
provider can run an agent. Gemini passed that check and failed every real
question.

### 5. The comparison found an application bug

Models that answer with markdown tables appeared broken in the UI, rendering as
rows of raw pipe characters. The cause was `react-markdown` being used without
`remark-gfm`, which is what adds table support.

Two different rendering failures were being read as model quality: GPT-4o mini
emits LaTeX that does not render, GLM emits tables that did not render. The
renderer was under-configured for both. Tables are now fixed; LaTeX is not.

### 6. One model questioned its own conversation history

On the elliptical follow-up, seven models computed the answer correctly.
DeepSeek refused, on the grounds that the previous turn stated a figure without
a tool call and it would not build on an unsourced number.

It was right — that history message was written by hand for the test. No other
model questioned it.

This is partly a harness artefact: in a real conversation the prior turn would
have been tool-backed. But the behaviour is notable, and it is the kind of
caution a financial tool arguably wants.

---

## Recommendation

**Keep GPT-4o mini as the default.** Fastest, cheapest, no failures, and its
refusals are correct if terse. Nothing in these results justifies moving off it
on quality grounds.

**GLM-5.2 is viable but not as a drop-in.** It produces the most informative
answers — tables, specific missing line items, explicit caveats about
receivables — at roughly 2.8× the latency, and it cannot be used on the
historical specialist without a schema change.

**Mixing models per specialist works and is a real option.** The system supports
a different model per agent, and running GLM-5.2 on current position, GPT-4o on
history, and DeepSeek on scenarios behaves correctly. The cost is a visibly
inconsistent voice between answers.

**Do not select GLM-5 Turbo on the assumption that it is fast.**

---

## Limitations

**One run per question.** Latency figures are single measurements, not averages.
The large gaps (3s versus 16s) are almost certainly real; a 0.2s difference is
not defensible.

**Answer quality was not scored.** The harness records objective properties —
routing, tools called, tokens, latency, failure. Which answer reads better is a
judgement made by reading the output, not a number the script produced. The
statements above about refusal quality are that judgement, not a measurement.

**GLM is three of eight entries**, so provider-level conclusions are weighted
toward it. Model-level conclusions are unaffected.

**Eight questions.** Chosen for coverage rather than volume. More questions of
the same kind would add little; questions of a different kind — long documents,
multi-turn sessions, other currencies — would likely surface different results.

**Claude is untested**, and it is named in the card.

**Run on `model-comparsion`, three commits behind `main`.** `main` has since added
tiered model configuration (`lib/ai/model-config.ts`) and tool-input repair. The
latter affects finding 3 directly — see the caveat there. The default model on
`main` is now `gpt-5.6-luna`, which is not in the catalogue and was not tested.
