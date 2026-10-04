import { selectStage4FallbackSpecs } from '@/lib/gen-ui/stage4-selection'

describe('Stage 4 widget selection', () => {
  it.each([
    ['show overdue customer invoices', 'overdue_invoices'],
    ['give me an invoice ageing report', 'invoice_ageing'],
    ['what customer payments are expected next week?', 'expected_payments'],
    ['which supplier bills are due in 14 days?', 'bills_due'],
  ])('maps %s to %s', (message, expectedType) => {
    expect(selectStage4FallbackSpecs(message)).toContainEqual({ type: expectedType })
  })

  it('does not treat supplier bills as expected customer payments', () => {
    expect(selectStage4FallbackSpecs('which bills are due next week?')).toEqual([{ type: 'bills_due' }])
  })
})
