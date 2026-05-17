import { calculateRunwayTool } from '@/lib/tools/financial/calculate-runway'
import { createGetLatestSnapshotTool } from '@/lib/tools/financial/get-latest-snapshot'
import { createModelScenarioTool } from '@/lib/tools/financial/model-scenario'
import type { AppTool } from '@/lib/tools/contracts'

export function getAgentTools(userId: string): AppTool[] {
  return [
    createGetLatestSnapshotTool(userId),
    calculateRunwayTool,
    createModelScenarioTool(userId),
  ]
}
