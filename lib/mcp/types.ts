// Shared contract for app-level tools.
// Each tool declares what it is called, what inputs it accepts,
// and the function that runs when the AI chooses to use it.

export interface McpTool<TInput, TOutput> {
  name: string
  description: string
  parameters: {
      type: 'object'
      properties: Record<string, unknown>
      required?: string[]
  }
  handler: (input: TInput) => Promise<TOutput> | TOutput
}