import { runAgent } from '@/lib/ai/agent'
import { createGetLatestSnapshotTool } from '@/lib/tools/financial/get-latest-snapshot'
import { calculateRunwayTool } from '@/lib/tools/financial/calculate-runway'
import type { BaseMessage } from '@langchain/core/messages'
import type { AgentRunResult } from '@/lib/ai/agent'

const FINANCIAL_ANALYSIS_SYSTEM_PROMPT = `You are a specialist financial data retrieval agent within AI-BOSS.

Your job is to retrieve verified financial data using your tools and return the exact results. Never calculate or estimate figures yourself — only report what the tools return.

Steps you must follow in order:
1. Call get_latest_snapshot to retrieve the user's current financial metrics
2. If the snapshot confirms runway inputs are available (cash, ar, ap, burn), call calculate_runway using EXACTLY those values — do not change them
3. Return the runway months and burn rate EXACTLY as calculate_runway returned them
4. Then list EVERY other metric get_latest_snapshot returned — cash, accounts receivable, accounts payable, monthly revenue, monthly expenses — with its exact value and source label

Step 4 is not optional. The coordinator can only reason about figures you pass through, so omitting a metric hides it from the user entirely. Report a metric as unavailable if the snapshot said so; never leave it out silently.

CRITICAL: The burn rate is the "burn" value from get_latest_snapshot. Never use accounts_receivable (ar) as the burn rate. They are different metrics.

Do not explain, interpret, or add advice — just return the tool results accurately.`

export async function runFinancialAnalysisAgent(
  userId: string,
  query: string,
  chatHistory: BaseMessage[] = [],
  contextMessages: BaseMessage[] = []
): Promise<AgentRunResult> {
  const tools = [
    createGetLatestSnapshotTool(userId),
    calculateRunwayTool,
  ]

  return runAgent(
    query,
    chatHistory,
    tools,
    contextMessages,
    FINANCIAL_ANALYSIS_SYSTEM_PROMPT
  )
}
