import {
  isGenUiRecipeEligible,
  listEligibleGenUiWidgetRecipes,
  type GenUiRecipeEligibilityContext,
} from '@/lib/gen-ui/eligibility'
import { GEN_UI_WIDGET_RECIPE_BY_ID } from '@/lib/gen-ui/recipes'

const BASE_CONTEXT: GenUiRecipeEligibilityContext = {
  availableMetricKeys: [],
  historicalMetricKey: null,
  hasHistoricalSeries: false,
  forecastMetricKey: null,
  hasForecastSeries: false,
  hasScenarioResult: false,
  companySize: null,
}

describe('Gen UI recipe eligibility', () => {
  it('requires the aggregate metrics named by a recipe', () => {
    expect(
      isGenUiRecipeEligible(GEN_UI_WIDGET_RECIPE_BY_ID.current_cash_balance, {
        ...BASE_CONTEXT,
        availableMetricKeys: ['cash'],
      })
    ).toBe(true)
    expect(
      isGenUiRecipeEligible(
        GEN_UI_WIDGET_RECIPE_BY_ID.current_cash_balance,
        BASE_CONTEXT
      )
    ).toBe(false)
  })

  it('requires a matching, non-empty historical or forecast series', () => {
    const eligible = listEligibleGenUiWidgetRecipes({
      ...BASE_CONTEXT,
      historicalMetricKey: 'cash',
      hasHistoricalSeries: true,
      forecastMetricKey: 'monthly_revenue',
      hasForecastSeries: true,
    }).map((recipe) => recipe.id)

    expect(eligible).toContain('cash_balance_trend')
    expect(eligible).toContain('revenue_forecast')
    expect(eligible).not.toContain('cash_runway_trend')
    expect(eligible).not.toContain('expense_forecast')
  })

  it('never exposes transaction, invoice, budget, or profitability recipes yet', () => {
    const eligible = listEligibleGenUiWidgetRecipes({
      ...BASE_CONTEXT,
      availableMetricKeys: [
        'cash',
        'accounts_receivable',
        'accounts_payable',
        'monthly_revenue',
        'monthly_expenses',
        'burn_rate',
        'runway_months',
      ],
      hasScenarioResult: true,
    }).map((recipe) => recipe.id)

    expect(eligible).not.toContain('overdue_invoices')
    expect(eligible).not.toContain('budget_variance_table')
    expect(eligible).not.toContain('profitability_summary')
    expect(eligible).not.toContain('customer_concentration')
  })

  it('requires a trusted scenario result and respects known company size', () => {
    const forecastRange = GEN_UI_WIDGET_RECIPE_BY_ID.forecast_range

    expect(
      isGenUiRecipeEligible(forecastRange, {
        ...BASE_CONTEXT,
        hasScenarioResult: true,
        companySize: 'small',
      })
    ).toBe(true)
    expect(
      isGenUiRecipeEligible(forecastRange, {
        ...BASE_CONTEXT,
        hasScenarioResult: true,
        companySize: 'micro',
      })
    ).toBe(false)
    expect(isGenUiRecipeEligible(forecastRange, BASE_CONTEXT)).toBe(false)
  })
})
