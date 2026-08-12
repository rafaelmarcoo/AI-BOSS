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

The current app registry lives in `lib/ai/tool-registry.ts`. It registers seven tools:

| Tool | Purpose |
|------|---------|
| `get_latest_snapshot` | Fetch the user's current source-aware financial metrics. Called first before any question about the current position. |
| `calculate_runway` | Calculate runway from confirmed cash, AR, AP, and burn values. |
| `model_scenario` | Model a what-if recurring cost change and compare before/after runway. |
| `get_runway_history` | Describe how runway has moved across historical observations. |
| `forecast_runway_trend` | Project runway forward from the observed trend. |
| `get_financial_history` | Historical values for a given metric. |
| `get_financial_forecast` | Deterministic forecast for a given metric. |

Tool ordering is enforced by the system prompt rather than by code: `get_latest_snapshot` must confirm real values before `calculate_runway` is called, so the agent cannot invent inputs.

---

## Files

| File | Purpose |
|------|---------|
| `lib/ai/agent.ts` | Agent logic and tool-calling loop |
| `lib/ai/tool-registry.ts` | App-owned tool registry for the agent |
| `lib/chat/system-prompt.ts` | Model name and system prompts |
| `lib/ai/tools.ts` | Adapter from app tools into LangChain tools |
| `Scripts/test-agent.ts` | Local test script — run with `npm run test:agent` |

---

## Clarifying Questions

The agent asks a focused follow-up instead of guessing when context is missing. The rules live in `AGENT_SYSTEM_PROMPT` under "Clarifying Questions".

It asks when the **source**, **time period**, **company/department**, or **metric** is ambiguous. It answers directly when only one option exists or the intent is unambiguous.

### QA examples

Verified manually against a seeded account. Expected behaviour:

| Question | Expected | Why |
|----------|----------|-----|
| "How much money do I have?" | Asks which source — uploaded CSV, Xero, or another file | "Money" is ambiguous, and multiple sources may exist |
| "How are we doing?" | Asks which aspect — runway, profitability, or growth | No metric specified |
| "What is our gross margin?" | Asks which company or department | Ratio is meaningless without knowing whose |
| "How did we do recently?" | Asks which period | "Recently" is not a date range |
| **"What is my runway?"** | **Answers directly** with months and burn rate | Runway inputs are confirmed, so nothing is ambiguous |

The last row matters most. Over-asking is a failure too — if the agent asks a clarifying question when runway inputs are already confirmed, the rules have regressed.

### Constraints

- One question at a time, never a list
- Never picks a source arbitrarily when several exist
- Never blends figures across companies unless asked
- Never invents a value to fill a gap
