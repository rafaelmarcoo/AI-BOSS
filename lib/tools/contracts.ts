import { z } from 'zod'

export interface AppTool {
  name: string
  description: string
  inputSchema: z.ZodType
  handler(input: unknown): Promise<unknown> | unknown
}

export interface StructuredTool<TInput, TOutput> extends AppTool {
  inputSchema: z.ZodType<TInput>
  handler(input: TInput): Promise<TOutput> | TOutput
}
