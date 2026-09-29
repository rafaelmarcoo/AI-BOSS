import type { GenUiWidget } from "@/lib/gen-ui/types";
import { widgetId } from "../shared";
import type { GenUiDataContext, PlannerWidget } from "../types";

export function buildScenarioAnalysisWidget(
  spec: PlannerWidget,
  index: number,
  context: GenUiDataContext
): GenUiWidget | null {
  if (!context.scenarioResult) return null

  return {
    id: widgetId(spec.type, index),
    type: 'scenario_analysis',
    title: spec.title ?? 'Scenario analysis',
    reason: spec.reason ?? 'This view uses the exact deterministic result returned to the chat assistant.',
    data: {
      result: context.scenarioResult,
      editHref: '/dashboard/scenarios',
    },
  }
}

