import type { FinancialMetricKey } from '@/lib/financial-data/metric-keys'
import {
  GEN_UI_WIDGET_RECIPES,
  type CompanySizeBand,
  type GenUiWidgetRecipe,
} from '@/lib/gen-ui/recipes'

export interface GenUiRecipeEligibilityContext {
  availableMetricKeys: readonly FinancialMetricKey[]
  historicalMetricKey: FinancialMetricKey | null
  hasHistoricalSeries: boolean
  forecastMetricKey: FinancialMetricKey | null
  hasForecastSeries: boolean
  hasScenarioResult: boolean
  companySize: CompanySizeBand | null
}

function hasAllMetrics(
  availableMetrics: Set<FinancialMetricKey>,
  requiredMetrics: readonly FinancialMetricKey[] | undefined
) {
  return !requiredMetrics || requiredMetrics.every((key) => availableMetrics.has(key))
}

function hasAnyMetric(
  availableMetrics: Set<FinancialMetricKey>,
  requiredMetrics: readonly FinancialMetricKey[] | undefined
) {
  return !requiredMetrics || requiredMetrics.some((key) => availableMetrics.has(key))
}

export function isGenUiRecipeEligible(
  recipe: GenUiWidgetRecipe,
  context: GenUiRecipeEligibilityContext
) {
  if (recipe.tier !== 'current' || !recipe.renderer) return false

  const availableMetrics = new Set(context.availableMetricKeys)
  const requirements = recipe.requirements

  if (!hasAllMetrics(availableMetrics, requirements.allMetrics)) return false
  if (!hasAnyMetric(availableMetrics, requirements.anyMetrics)) return false

  if (
    requirements.historyMetric &&
    (!context.hasHistoricalSeries ||
      context.historicalMetricKey !== requirements.historyMetric)
  ) {
    return false
  }

  if (
    requirements.forecastMetric &&
    (!context.hasForecastSeries ||
      context.forecastMetricKey !== requirements.forecastMetric)
  ) {
    return false
  }

  if (requirements.scenarioResult && !context.hasScenarioResult) return false

  if (context.companySize && !recipe.audience.includes(context.companySize)) {
    return false
  }

  return true
}

export function listEligibleGenUiWidgetRecipes(
  context: GenUiRecipeEligibilityContext
): GenUiWidgetRecipe[] {
  return GEN_UI_WIDGET_RECIPES.filter((recipe) =>
    isGenUiRecipeEligible(recipe, context)
  )
}
