import { tool, type StructuredTool as LangChainStructuredTool } from '@langchain/core/tools'
import type {
  AppTool,
  StructuredTool as AppStructuredTool,
} from '@/lib/tools/contracts'

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
  appTools: AppTool[]
): LangChainStructuredTool[] {
  return appTools.map(adaptToolToLangChain)
}
