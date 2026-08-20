import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages'
import {
  createChatModel,
  resolveModel,
  DEFAULT_MODEL,
  type ModelName,
} from '@/lib/ai/models'
import { AGENT_SYSTEM_PROMPT } from '@/lib/chat/system-prompt'
import { adaptToolsToLangChain } from '@/lib/ai/tools'
import type { AppTool } from '@/lib/tools/contracts'

export interface AgentToolUsage {
  tool: string
  args: unknown
}

export interface AgentRunResult {
  content: string
  tokensUsed: number | null
  toolsUsed: AgentToolUsage[]
}

interface FinancialToolResult {
  name: string
  content: string
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

function createAgentModel(model: ModelName = DEFAULT_MODEL) {
  return createChatModel(model, { temperature: 0 })
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
  systemPrompt: string = AGENT_SYSTEM_PROMPT,
  modelName: ModelName = DEFAULT_MODEL
): Promise<AgentRunResult> {
  const model = createAgentModel(modelName)
  const dialect =
    resolveModel(modelName).provider.sdk === 'google' ? 'google' : 'json-schema'
  const langChainTools = adaptToolsToLangChain(tools, dialect)

  if (langChainTools.length > 0 && typeof model.bindTools !== 'function') {
    throw new Error(
      `Model "${modelName}" does not support tool calling, which this agent requires.`
    )
  }

  const llm =
    langChainTools.length > 0 && model.bindTools
      ? model.bindTools(langChainTools)
      : model

  const messages = buildAgentMessages({
    input,
    chatHistory,
    contextMessages,
    systemPrompt,
  })

  const MAX_ITERATIONS = 10
  let totalTokensUsed = 0
  const toolsUsed: AgentToolUsage[] = []
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
      }
    }

    for (const toolCall of response.tool_calls) {
      const tool = langChainTools.find(t => t.name === toolCall.name)
      if (!tool) continue

      toolsUsed.push({
        tool: toolCall.name,
        args: toolCall.args,
      })

      const result = await tool.invoke(toolCall.args)
      const resultContent = String(result)
      financialToolResults.push({ name: toolCall.name, content: resultContent })
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
