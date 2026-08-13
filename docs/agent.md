# Agent Configuration

## Overview

AI-BOSS uses a LangChain-powered agent to handle user queries. The agent supports tool calling, meaning it can invoke registered tools (like the runway calculator) and reason about the results before responding.

**Implemented in:** `lib/ai/agent.ts` - `runAgent()`
**System prompt:** `lib/chat/system-prompt.ts` - `AGENT_SYSTEM_PROMPT`

---

## Model

| Setting | Value |
|---------|-------|
| Model | `gpt-4o-mini-2024-07-18` |
| Temperature | `0` (deterministic responses) |
| Provider | OpenAI via `@langchain/openai` |

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
| `calculate_runway` | Calculates runway from confirmed cash, receivables, payables, and burn. |
| `model_scenario` | Models a read-only recurring cost or saving scenario. |
| `get_financial_history` | Summarises deterministic historical movement for a supported metric. |
| `get_financial_forecast` | Creates a deterministic 3- or 6-month trend-continuation forecast. |

Supporting document context provides retrieved evidence, not calculated dashboard values. The agent does not have a separate snapshot-based trend tool. Historical and forecast questions use the generic observation-based tools, which read from `financial_metric_observations`.

## Clarifying questions

When a request is materially ambiguous, AI-BOSS asks one focused follow-up instead of guessing. For example, it asks whether “money” means cash, revenue, or runway, and asks for a source or reporting period when multiple options are available.

It answers directly when the metric, source, and period are clear. AI-BOSS does not claim unsupported ratio calculations, company comparisons, department analysis, or currency conversion.

---

## Files

| File | Purpose |
|------|---------|
| `lib/ai/agent.ts` | Agent logic and tool-calling loop |
| `lib/ai/tool-registry.ts` | App-owned tool registry for the agent |
| `lib/chat/system-prompt.ts` | Model name and system prompts |
| `lib/ai/tools.ts` | Adapter from app tools into LangChain tools |
| `Scripts/test-agent.ts` | Local test script — run with `npm run test:agent` |

`npm run test:agent` requires `OPENAI_API_KEY` and `TEST_USER_ID`. The script reads `.env.local` when present and otherwise uses existing environment variables.

## PDF metric extraction

PDF documents remain available for retrieved document context. A PDF contributes structured financial metrics only when AI-BOSS finds a clear labelled reporting date and a supported labelled value. Extracted values retain the document filename, page excerpt, confidence, and detected currency. Undated PDFs do not affect dashboard metrics, history, or forecasts.
