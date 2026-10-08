import { z } from 'zod'
import { tool, type StructuredTool as LangChainStructuredTool } from '@langchain/core/tools'
import type {
  AppTool,
  StructuredTool as AppStructuredTool,
} from '@/lib/tools/contracts'

const KEYWORDS_GOOGLE_REJECTS = [
  '$schema',
  'additionalProperties',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'const',
  'examples',
  'default',
] as const

function rewriteConst(node: Record<string, unknown>): Record<string, unknown> {
  if (!('const' in node)) return node

  const { const: value, ...rest } = node

  if (typeof value === 'string') {
    return { ...rest, enum: [value] }
  }

  const note = `Must be exactly ${JSON.stringify(value)}.`
  return {
    ...rest,
    description:
      typeof rest.description === 'string' ? `${rest.description} ${note}` : note,
  }
}

export function stripUnsupportedKeywords(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(stripUnsupportedKeywords)
  }

  if (node === null || typeof node !== 'object') {
    return node
  }

  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(rewriteConst(node as Record<string, unknown>))) {
    if ((KEYWORDS_GOOGLE_REJECTS as readonly string[]).includes(key)) continue
    result[key] = stripUnsupportedKeywords(value)
  }

  return result
}

export type SchemaDialect = 'json-schema' | 'google'

export function adaptToolToLangChain<TInput, TOutput>(
  appTool: AppStructuredTool<TInput, TOutput>,
  dialect: SchemaDialect = 'json-schema'
): LangChainStructuredTool {
  const schema =
    dialect === 'google'
      ? (stripUnsupportedKeywords(z.toJSONSchema(appTool.inputSchema)) as Record<
          string,
          unknown
        >)
      : appTool.inputSchema

  return tool(
    async (input) => JSON.stringify(await appTool.handler(input as TInput)),
    {
      name: appTool.name,
      description: appTool.description,
      schema: schema as never,
    }
  )
}

export function adaptToolsToLangChain(
  appTools: AppTool[],
  dialect: SchemaDialect = 'json-schema'
): LangChainStructuredTool[] {
  return appTools.map((appTool) => adaptToolToLangChain(appTool, dialect))
}
