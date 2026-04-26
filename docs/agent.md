# Agent Configuration

## Overview

AI-BOSS uses a LangChain-powered agent to handle user queries. The agent supports tool calling, meaning it can invoke registered tools (like the runway calculator) and reason about the results before responding.

**Implemented in:** `lib/ai/agent.ts` - `runAgent()`
**System prompt:** `lib/chat/system-prompt.ts` - `AGENT_SYSTEM_PROMPT`

---

## Model

| Setting | Value |
|---------|-------|
| Model | `gpt-4o-mini` |
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

Tools are passed into `runAgent()` as an array. Each tool must extend `StructuredTool` from `@langchain/core/tools`.

```ts
import { runAgent } from '@/lib/ai/agent'

const response = await runAgent(input, chatHistory, [calculateRunwayTool])
```

Card 11 registers the first tool — `calculate_runway`.

---

## Files

| File | Purpose |
|------|---------|
| `lib/ai/agent.ts` | Agent logic and tool-calling loop |
| `lib/chat/system-prompt.ts` | Model name and system prompts |
| `Scripts/test-agent.ts` | Local test script — run with `npm run test:agent` |
