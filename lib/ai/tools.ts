import { tool, type StructuredTool as LangChainStructuredTool } from '@langchain/core/tools'
import type { StructuredTool as AppStructuredTool } from '@/lib/tools/contracts'

export function adaptToolToLangChain<TInput, TOutput>(
  appTool: AppStructuredTool<TInput, TOutput>
): LangChainStructuredTool {
  return tool(
    async (input) => JSON.stringify(await appTool.handler(input as TInput)),
    {
      name: appTool.name,
      description: appTool.description,
      schema: appTool.inputSchema,
    }
  )
}

export function adaptToolsToLangChain(
  appTools: Array<AppStructuredTool<unknown, unknown>>
): LangChainStructuredTool[] {
  return appTools.map(adaptToolToLangChain)
}
