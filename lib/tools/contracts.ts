import { z } from 'zod'

export interface StructuredTool<TInput, TOutput> {
  name: string
  description: string
  inputSchema: z.ZodType<TInput>
  handler: (input: TInput) => Promise<TOutput> | TOutput
}
