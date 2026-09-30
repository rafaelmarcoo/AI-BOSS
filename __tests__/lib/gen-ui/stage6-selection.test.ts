import { selectStage6FallbackSpecs } from '@/lib/gen-ui/stage6-selection'

describe('Stage 6 widget selection', () => {
  it.each([
    ['show revenue by customer', 'customer_revenue_breakdown'],
    ['are we too dependent on our largest client?', 'customer_concentration_risk'],
    ['break revenue down by product', 'product_service_revenue'],
    ['show subscription revenue this year', 'product_service_revenue'],
    ['revenue by business unit', 'product_service_revenue'],
  ])('maps %s to %s', (message, expected) => {
    expect(selectStage6FallbackSpecs(message)).toContainEqual({ type: expected })
  })
})
