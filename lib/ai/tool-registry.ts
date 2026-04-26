import { calculateRunwayTool } from '@/lib/tools/financial/calculate-runway'
import type { AppTool } from '@/lib/tools/contracts'

export function getAgentTools(): AppTool[] {
  return [calculateRunwayTool]
}
