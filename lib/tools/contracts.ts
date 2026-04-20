export interface StructuredTool<TInput, TOutput> {
  name: string
  description: string
  inputSchema: unknown
  handler: (input: TInput) => Promise<TOutput> | TOutput
}
