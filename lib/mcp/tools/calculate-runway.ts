import type { McpTool } from '../types'

export interface CalculateRunwayInput {
  monthlyBurn: number
  cashBalance: number
}

export interface CalculateRunwayOutput {
  runwayMonths: number
  calculationMethod: 'cash_balance_divided_by_monthly_burn'
}

// First MCP-style tool for financial calculations.
// The schema describes the structured inputs the AI can send,
// and the handler returns structured data the chat layer can cite.
export const calculateRunwayTool: McpTool<
  CalculateRunwayInput,
  CalculateRunwayOutput
> = {
  name: 'calculate_runway',
  description: 'Calculate runway in months using current cash balance and monthly burn.',
  parameters: {
    type: 'object',
    properties: {
      // Current amount of cash the company has available.
      cashBalance: {
        type: 'number',
        description: 'Current cash balance for the business.',
      },
      // Amount of cash the company loses each month.
      monthlyBurn: {
        type: 'number',
        description: 'Monthly cash burn rate for the business.',
      },
    },
    required: ['cashBalance', 'monthlyBurn'],
  },

  // Runs when the AI chooses this tool.
  // It receives structured input and returns structured output.
  handler(input) {
    // Prevent division by zero or negative burn values from breaking the calculation.
    if (input.monthlyBurn <= 0) {
      return {
        runwayMonths: Number.POSITIVE_INFINITY,
        calculationMethod: 'cash_balance_divided_by_monthly_burn',
      }
    }

    // Main runway formula: available cash divided by monthly burn.
    return {
      runwayMonths: input.cashBalance / input.monthlyBurn,
      calculationMethod: 'cash_balance_divided_by_monthly_burn',
    }
  },
}
