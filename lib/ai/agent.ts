import { ChatOpenAI } from '@langchain/openai'
import { StructuredTool } from '@langchain/core/tools'
import { BaseMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages'
import { CHAT_MODEL, AGENT_SYSTEM_PROMPT } from '@/lib/chat/system-prompt'

const model = new ChatOpenAI({
  model: CHAT_MODEL,
  temperature: 0,
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * Runs the AI-BOSS agent with a user message and optional conversation history.
 * Supports tool calling
 */
export async function runAgent(
  input: string,
  chatHistory: BaseMessage[] = [],
  tools: StructuredTool[] = [],
): Promise<string> {
  const llm = tools.length > 0 ? model.bindTools(tools) : model

  const messages: BaseMessage[] = [
    new SystemMessage(AGENT_SYSTEM_PROMPT),
    ...chatHistory,
    new HumanMessage(input),
  ]

  const MAX_ITERATIONS = 10
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await llm.invoke(messages)
    messages.push(response)

    if (!response.tool_calls || response.tool_calls.length === 0) {
      return typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content)
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
