# Agent Configuration

## Overview

AI-BOSS uses a LangChain-powered agent to handle user queries. The agent supports tool calling, meaning it can invoke registered tools (like the runway calculator) and reason about the results before responding.

**Implemented in:** `lib/ai/agent.ts` - `runAgent()`
**System prompt:** `lib/chat/system-prompt.ts` - `AGENT_SYSTEM_PROMPT`

---

## Models

| Workload | Default model | Server override |
|---|---|---|
| Main chat, tool calling, scenario interpretation, and generated UI planning | `gpt-5.6-luna` with reasoning effort `low` | `OPENAI_CHAT_MODEL` |
| Cosmetic conversation titles | `gpt-4o-mini-2024-07-18` with temperature `0` | `OPENAI_UTILITY_MODEL` |

Both models use OpenAI through `@langchain/openai`. The environment variables are optional: the defaults above apply when they are unset or blank. They are server-only and must not use the `NEXT_PUBLIC_` prefix.

Financial arithmetic is still deterministic TypeScript. The language model interprets requests, selects tools, and explains validated results; changing the model does not change the calculation formulas.

---

## How the Tool-Calling Loop Works

1. User message + conversation history is sent to the model
2. If the model decides to call a tool, it returns a tool call request
3. The agent executes the tool and feeds the result back to the model
4. The model reasons about the result and produces a final response
5. If no tool is needed, the model responds directly

The loop has a maximum of 10 iterations to prevent infinite loops.

---

## Registering Tools

Tools are passed into `runAgent()` as an array of app-owned tools from `lib/tools/`. The agent adapts them into LangChain tools internally.

For the wider application architecture, treat the agent as the orchestration layer and keep reusable business tooling behind the `lib/tools/` boundary. That keeps financial logic portable for future MCP-style adapters, policy enforcement, and explainable tool responses.

```ts
import { runAgent } from '@/lib/ai/agent'
import { calculateRunwayTool } from '@/lib/tools/financial/calculate-runway'

const response = await runAgent(input, chatHistory, [calculateRunwayTool])
```

The current app registry lives in `lib/ai/tool-registry.ts` and registers five app-owned tools. Retrieved document context is supplied separately to the agent:

| Tool | Purpose |
|---|---|
| `get_latest_snapshot` | Reads source-aware current metrics and confirms runway inputs. |
| `calculate_runway` | Calculates primary cash runway and separately labelled working-capital-adjusted runway from confirmed inputs. |
| `model_scenario` | Validates and calculates one to three source-aware what-if alternatives using the shared deterministic scenario engine. |
| `get_financial_history` | Summarises deterministic historical movement for a supported metric. |
| `get_financial_forecast` | Creates a deterministic 3- or 6-month trend-continuation forecast. |

Supporting document context provides retrieved evidence, not calculated dashboard values. The agent does not have a separate snapshot-based trend tool. Historical and forecast questions use the generic observation-based tools, which read from `financial_metric_observations`.

## Clarifying questions

When a request is materially ambiguous, AI-BOSS asks one focused follow-up instead of guessing. Scenario clarifications follow a stable order: source/currency, missing baseline values, amount or percentage, fixed versus compounding, one-off versus recurring, and timing. Annual salary alone is not treated as employer cost; staffing scenarios require a confirmed total monthly employer cost or saving and keep recruitment, equipment, and redundancy costs separate.

It answers directly when the metric, source, and period are clear. AI-BOSS does not claim unsupported ratio calculations, company comparisons, department analysis, or currency conversion.

---

## Files

| File | Purpose |
|------|---------|
| `lib/ai/agent.ts` | Agent logic and tool-calling loop |
| `lib/ai/tool-registry.ts` | App-owned tool registry for the agent |
| `lib/ai/model-config.ts` | Server-side model defaults and environment overrides |
| `lib/chat/system-prompt.ts` | System prompts |
| `lib/ai/tools.ts` | Adapter from app tools into LangChain tools |
| `Scripts/test-agent.ts` | Local test script — run with `npm run test:agent` |

`npm run test:agent` requires `OPENAI_API_KEY` and `TEST_USER_ID`. The script reads `.env.local` when present and otherwise uses existing environment variables.

## Optional multi-agent routing

Set `MULTI_AGENT_MODE=true` only in a chosen server environment to use deterministic specialist routing. It is disabled by default. The router assigns each request to one specialist: current financial position/runway, historical review/forecasting, or general scenario comparisons. Each specialist has only the tools needed for its role, while calculations remain deterministic and the final answer still follows the shared AI-BOSS safety guidance.

## PDF metric extraction

CSV, XLSX, and text PDF documents can provide retrieved evidence before review, clearly identified as unreviewed context. Deterministically extracted metric candidates never become calculation inputs automatically. A user must explicitly include or exclude every candidate, correct any metric/value/NZD-or-AUD currency/reporting date, and approve the complete review. Only the resulting User-confirmed observations may affect dashboard metrics, history, forecasts, scenarios, or deterministic tools. Scanned PDFs remain stored and previewable, but OCR extraction is deferred.
