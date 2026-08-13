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
    'Calculate runway months from confirmed cash, accounts receivable, accounts payable, and monthly burn rate. Use only values returned by get_latest_snapshot or values explicitly supplied by the user; never invent inputs.',
  inputSchema: RunwayInputSchema,
  handler(input) {
    return calculateRunwayResult(input)
  },
}
