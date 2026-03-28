import type { NextRequest } from 'next/server'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import { getMcpToolByName } from '@/lib/mcp/tools'

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)

    // Read the user's chat message from the request body.
    const body = await request.json()
    const message = typeof body.message === 'string' ? body.message : ''

    // Very first version of tool selection:
    // if the user mentions runway, we call the runway tool.
    const isRunwayQuestion = /runway/i.test(message)

    if (isRunwayQuestion) {
      // Look up the tool from the shared registry instead of importing it directly.
      // This keeps the chat route flexible as we add more tools later.
      const runwayTool = getMcpToolByName('calculate_runway')

      if (!runwayTool) {
        throw new Error('calculate_runway tool is not registered.')
      }

      // Temporary hardcoded inputs so we can prove the tool flow works end-to-end.
      // Later this should come from the calculation engine or financial snapshot data.
      const toolInput = {
        cashBalance: 50000,
        monthlyBurn: 10000,
      }
      const toolResult = await runwayTool.handler(toolInput)

      return successResponse({
        service: 'chat',
        reply: `Your estimated runway is ${toolResult.runwayMonths} months.`,
        toolsUsed: [
          {
            tool: runwayTool.name,
            description: runwayTool.description,
            input: toolInput,
            result: toolResult,
          },
        ],
        user,
      })
    }

    // Fallback response when no tool is needed yet.
    return successResponse({
      service: 'chat',
      reply: 'I can help with runway questions. Try asking "What is my runway?"',
      toolsUsed: [],
      user,
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
