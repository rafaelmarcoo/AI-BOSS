import { runAgent } from '@/lib/ai/agent'
import { createGetLatestSnapshotTool } from '@/lib/tools/financial/get-latest-snapshot'
import { calculateRunwayTool } from '@/lib/tools/financial/calculate-runway'
import type { AgentRunResult } from '@/lib/ai/agent'

const FINANCIAL_ANALYSIS_SYSTEM_PROMPT = `You are a specialist financial analysis agent within AI-BOSS.

Your only job is to retrieve the user's current financial position and explain it clearly.

You have two tools:
- get_latest_snapshot: always call this first to retrieve verified financial metrics
- calculate_runway: call this after get_latest_snapshot if runway inputs are available

Rules:
- Always call get_latest_snapshot before anything else
- Never invent or assume financial figures
- After retrieving data, calculate runway if inputs are available
- Report all key metrics: cash, burn rate, accounts receivable, accounts payable, runway months
- Calculate and explain CIMA ratios if revenue and expense data is available:
  - Gross margin = (Revenue - Cost of Sales) / Revenue × 100
  - Operating margin = Operating Profit / Revenue × 100
  - Current ratio = Current Assets / Current Liabilities
- Flag immediately if runway is under 6 months (caution) or under 3 months (urgent)
- Be concise and precise — you are a specialist, not a generalist
- Return a clear, structured financial summary for the coordinator to present to the user`

export async function runFinancialAnalysisAgent(
  userId: string,
  query: string
): Promise<AgentRunResult> {
  const tools = [
    createGetLatestSnapshotTool(userId),
    calculateRunwayTool,
  ]

  return runAgent(query, [], tools, [], FINANCIAL_ANALYSIS_SYSTEM_PROMPT)
}
