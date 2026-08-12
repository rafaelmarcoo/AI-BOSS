import { calculateRunwayTool } from '@/lib/tools/financial/calculate-runway'
import { createForecastRunwayTrendTool } from '@/lib/tools/financial/forecast-runway-trend'
import { createGetFinancialHistoryTool } from '@/lib/tools/financial/get-financial-history'
import { createGetLatestSnapshotTool } from '@/lib/tools/financial/get-latest-snapshot'
import { createGetRunwayHistoryTool } from '@/lib/tools/financial/get-runway-history'
import { createModelScenarioTool } from '@/lib/tools/financial/model-scenario'
import type { AppTool } from '@/lib/tools/contracts'

export function getAgentTools(userId: string): AppTool[] {
  return [
    createGetLatestSnapshotTool(userId),
    calculateRunwayTool,
    createModelScenarioTool(userId),
    createGetRunwayHistoryTool(userId),
    createGetFinancialHistoryTool(userId),
    createForecastRunwayTrendTool(userId),
  ]
}
