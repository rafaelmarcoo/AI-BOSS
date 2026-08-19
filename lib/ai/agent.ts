import { ChatOpenAI } from '@langchain/openai'
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages'
import { ToolInputParsingException } from '@langchain/core/tools'
import { ApiError } from '@/lib/api/errors'
import { AGENT_SYSTEM_PROMPT } from '@/lib/chat/system-prompt'
import { CHAT_MODEL, mainModelOptions } from '@/lib/ai/model-config'
import { adaptToolsToLangChain } from '@/lib/ai/tools'
import type { AppTool } from '@/lib/tools/contracts'

export interface AgentToolUsage {
  tool: string
  args: unknown
}

export interface AgentToolExecution extends AgentToolUsage {
  result: unknown
}

export interface AgentRunResult {
  content: string
  tokensUsed: number | null
  toolsUsed: AgentToolUsage[]
  toolExecutions?: AgentToolExecution[]
}

interface FinancialToolResult {
  name: string
  content: string
}

export function toolInputRepairResult(toolName: string, error: unknown) {
  if (!(error instanceof ToolInputParsingException)) return null

  return {
    status: 'invalid_tool_input',
    tool: toolName,
    message: 'The tool arguments did not match the required structure. Correct the arguments and call the same tool again. Do not calculate the answer yourself.',
    details: error.message,
  }
}

export function preserveFinancialCurrencyCoverage(
  response: string,
  toolResults: FinancialToolResult[]
) {
  const relevantResults = toolResults.filter(({ name }) =>
    name === 'get_financial_history' || name === 'get_financial_forecast'
  )
  const missingCurrencyBlocks = ['NZD', 'AUD'].flatMap((currency) => {
    const toolContainsCurrency = relevantResults.some(({ content }) =>
      new RegExp(`\\b${currency}\\b`).test(content)
    )
    const responseContainsCurrency = new RegExp(`\\b${currency}\\b`).test(response)

    if (!toolContainsCurrency || responseContainsCurrency) return []

    return relevantResults.flatMap(({ content }) =>
      content
        .split(/\n\s*\n/)
        .filter((block) => new RegExp(`\\b${currency}\\b`).test(block))
    )
  })
  const uniqueBlocks = [...new Set(missingCurrencyBlocks)]

  if (uniqueBlocks.length === 0) return response

  return `${response}\n\nAdditional currency series from the deterministic analysis:\n\n${uniqueBlocks.join('\n\n')}`
}

function createAgentModel() {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Missing required environment variable: OPENAI_API_KEY.'
    )
  }

  return new ChatOpenAI({
    model: CHAT_MODEL,
    ...mainModelOptions(),
    apiKey,
  })
}

function readTotalTokens(message: BaseMessage) {
  if (!AIMessage.isInstance(message)) {
    return 0
  }

  return message.usage_metadata?.total_tokens ?? 0
}

/**
 * Runs the AI-BOSS agent with a user message and optional conversation history.
 * Supports tool calling
 */
export async function runAgent(
  input: string,
  chatHistory: BaseMessage[] = [],
  tools: AppTool[] = [],
  contextMessages: BaseMessage[] = [],
  systemPrompt: string = AGENT_SYSTEM_PROMPT
): Promise<AgentRunResult> {
  const model = createAgentModel()
  const langChainTools = adaptToolsToLangChain(tools)
  const llm = langChainTools.length > 0 ? model.bindTools(langChainTools) : model

  const messages = buildAgentMessages({
    input,
    chatHistory,
    contextMessages,
    systemPrompt,
  })

  const MAX_ITERATIONS = 10
  let totalTokensUsed = 0
  const toolsUsed: AgentToolUsage[] = []
  const toolExecutions: AgentToolExecution[] = []
  const financialToolResults: FinancialToolResult[] = []

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await llm.invoke(messages)
    totalTokensUsed += readTotalTokens(response)
    messages.push(response)

    if (!response.tool_calls || response.tool_calls.length === 0) {
      const content = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content)

      return {
        content: preserveFinancialCurrencyCoverage(content, financialToolResults),
        tokensUsed: totalTokensUsed > 0 ? totalTokensUsed : null,
        toolsUsed,
        toolExecutions,
      }
    }

    for (const toolCall of response.tool_calls) {
      const tool = langChainTools.find(t => t.name === toolCall.name)
      if (!tool) continue

      toolsUsed.push({
        tool: toolCall.name,
        args: toolCall.args,
      })

      let resultContent: string
      let parsedResult: unknown
      try {
        const result = await tool.invoke(toolCall.args)
        resultContent = String(result)
        parsedResult = resultContent
        try {
          parsedResult = JSON.parse(resultContent)
        } catch {
          // Older tools return plain text. Preserve it without weakening the
          // structured result path used by scenario analysis.
        }
      } catch (error) {
        const repairResult = toolInputRepairResult(toolCall.name, error)
        if (!repairResult) throw error
        parsedResult = repairResult
        resultContent = JSON.stringify(repairResult)
      }
      toolExecutions.push({
        tool: toolCall.name,
        args: toolCall.args,
        result: parsedResult,
      })
      if (!(typeof parsedResult === 'object' && parsedResult && 'status' in parsedResult && parsedResult.status === 'invalid_tool_input')) {
        financialToolResults.push({ name: toolCall.name, content: resultContent })
      }
      messages.push(new ToolMessage({ content: resultContent, tool_call_id: toolCall.id ?? '' }))
    }
  }

  throw new Error('Agent exceeded maximum iterations without producing a response.')
}

export function buildAgentMessages(params: {
  input: string
  chatHistory?: BaseMessage[]
  contextMessages?: BaseMessage[]
  systemPrompt?: string
}) {
  return [
    new SystemMessage(params.systemPrompt ?? AGENT_SYSTEM_PROMPT),
    ...(params.contextMessages ?? []),
    ...(params.chatHistory ?? []),
    new HumanMessage(params.input),
  ]
}
