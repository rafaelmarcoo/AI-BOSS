import { calculateRunwayTool } from '@/lib/tools/financial/calculate-runway'
import { createGetLatestSnapshotTool } from '@/lib/tools/financial/get-latest-snapshot'
import type { AppTool } from '@/lib/tools/contracts'

export function getAgentTools(userId: string): AppTool[] {
  return [
    createGetLatestSnapshotTool(userId),
    calculateRunwayTool,
  ]
}
