import { calculateRunwayTool } from '@/lib/mcp/tools/calculate-runway'

describe('calculateRunwayTool', () => {
  it('calculates runway months from cash balance and monthly burn', async () => {
    const result = await calculateRunwayTool.handler({
      cashBalance: 50000,
      monthlyBurn: 10000,
    })

    expect(result).toEqual({
      runwayMonths: 5,
      calculationMethod: 'cash_balance_divided_by_monthly_burn',
    })
  })
})
