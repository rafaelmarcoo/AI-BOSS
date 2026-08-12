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
    'Calculates cash runway in months and returns a policy assessment (healthy / caution / urgent). ' +
    'IMPORTANT: Only call this after get_latest_snapshot has returned confirmed real values for cash, ar, ap, and burn. ' +
    'Never pass invented, assumed, or estimated values — use the exact numbers from get_latest_snapshot. ' +
    'Returns runway months, a full calculation breakdown, and an urgent/caution/healthy status with recommended action.',
  inputSchema: RunwayInputSchema,
  handler(input) {
    return calculateRunwayResult(input)
  },
}
