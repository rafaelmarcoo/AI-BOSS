import {
  RunwayInput,
  RunwayInputSchema,
  RunwayResult,
} from '@/lib/calculations/runway'
import { calculateRunwayResult } from '@/lib/services/runway-service'
import { StructuredTool } from '@/lib/tools/contracts'

export const calculateRunwayTool: StructuredTool<RunwayInput, RunwayResult> = {
  name: 'calculate_runway',
  description:
    'Calculate runway months from cash, accounts receivable, accounts payable, and burn rate.',
  inputSchema: RunwayInputSchema,
  handler(input) {
    return calculateRunwayResult(input)
  },
}
