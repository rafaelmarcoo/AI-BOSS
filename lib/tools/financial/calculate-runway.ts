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
    'Calculate both conservative cash runway (cash / monthly burn) and working-capital-adjusted runway ((cash + receivables - payables) / monthly burn). For stored data, call this only when get_latest_snapshot explicitly returns Confirmed runway inputs and working-capital-adjusted runway status AVAILABLE. Never substitute individually listed values when that tool returns UNAVAILABLE.',
  inputSchema: RunwayInputSchema,
  handler(input) {
    return calculateRunwayResult(input)
  },
}
