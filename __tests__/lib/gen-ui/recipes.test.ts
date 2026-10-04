import {
  GEN_UI_WIDGET_RECIPES,
  GEN_UI_WIDGET_RECIPE_BY_ID,
} from '@/lib/gen-ui/recipes'

describe('Gen UI accountant widget recipes', () => {
  it('registers all 50 requested recipes exactly once and in order', () => {
    expect(GEN_UI_WIDGET_RECIPES).toHaveLength(50)
    expect(GEN_UI_WIDGET_RECIPES.map((recipe) => recipe.number)).toEqual(
      Array.from({ length: 50 }, (_, index) => index + 1)
    )
    expect(new Set(GEN_UI_WIDGET_RECIPES.map((recipe) => recipe.id)).size).toBe(50)
  })

  it('gives every recipe enough context for safe AI selection', () => {
    for (const recipe of GEN_UI_WIDGET_RECIPES) {
      expect(recipe.label).not.toHaveLength(0)
      expect(recipe.description).not.toHaveLength(0)
      expect(recipe.selectionGuidance).not.toHaveLength(0)
      expect(recipe.audience.length).toBeGreaterThan(0)
      expect(recipe.redundancyGroup).not.toHaveLength(0)
    }
  })

  it('maps implemented invoice recipes while keeping future recipes unavailable', () => {
    const overdueInvoices = GEN_UI_WIDGET_RECIPE_BY_ID.overdue_invoices
    const receivablesAgeing = GEN_UI_WIDGET_RECIPE_BY_ID.receivables_ageing
    const upcomingBills = GEN_UI_WIDGET_RECIPE_BY_ID.upcoming_bills_timeline
    const expectedPayments = GEN_UI_WIDGET_RECIPE_BY_ID.expected_customer_payments
    const budgetVariance = GEN_UI_WIDGET_RECIPE_BY_ID.budget_variance_table

    expect(overdueInvoices.renderer).toBe('overdue_invoices')
    expect(receivablesAgeing.renderer).toBe('invoice_ageing')
    expect(upcomingBills.renderer).toBe('bills_due')
    expect(expectedPayments.renderer).toBe('expected_payments')
    expect(overdueInvoices.requirements.futureCapabilities).toContain(
      'sales_invoices'
    )
    expect(budgetVariance.renderer).toBeNull()
    expect(budgetVariance.requirements.futureCapabilities).toContain(
      'budget_lines'
    )
  })
})
