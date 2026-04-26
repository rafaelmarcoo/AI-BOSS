import { ChatOpenAI } from '@langchain/openai'
import { StructuredTool } from '@langchain/core/tools'
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages'
import { ApiError } from '@/lib/api/errors'
import { CHAT_MODEL, AGENT_SYSTEM_PROMPT } from '@/lib/chat/system-prompt'

export interface AgentRunResult {
  content: string
  tokensUsed: number | null
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
    temperature: 0,
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
  tools: StructuredTool[] = [],
): Promise<AgentRunResult> {
  const model = createAgentModel()
  const llm = tools.length > 0 ? model.bindTools(tools) : model

  const messages: BaseMessage[] = [
    new SystemMessage(AGENT_SYSTEM_PROMPT),
    ...chatHistory,
    new HumanMessage(input),
  ]

  const MAX_ITERATIONS = 10
  let totalTokensUsed = 0

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await llm.invoke(messages)
    totalTokensUsed += readTotalTokens(response)
    messages.push(response)

    if (!response.tool_calls || response.tool_calls.length === 0) {
      return {
        content:
          typeof response.content === 'string'
            ? response.content
            : JSON.stringify(response.content),
        tokensUsed: totalTokensUsed > 0 ? totalTokensUsed : null,
      }
    }

    for (const toolCall of response.tool_calls) {
      const tool = tools.find(t => t.name === toolCall.name)
      if (!tool) continue

      const result = await tool.invoke(toolCall.args)
      messages.push(new ToolMessage({ content: String(result), tool_call_id: toolCall.id ?? '' }))
    }
  }

  throw new Error('Agent exceeded maximum iterations without producing a response.')
}
