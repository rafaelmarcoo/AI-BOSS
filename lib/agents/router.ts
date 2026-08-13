export type FinancialSpecialist =
  | 'financial_position'
  | 'historical_forecast'
  | 'scenario'

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

export function routeFinancialQuestion(query: string): FinancialSpecialist {
  const value = normalize(query)

  if (
    /\b(what if|scenario|hire|new employee|subscription|lease|cut|reduce|increase|decrease|save|saving|cost change|spend)\b/.test(value) ||
    /\b(burn|cost|expense|spend)\b[^.?!]{0,40}%/.test(value)
  ) {
    return 'scenario'
  }

  if (
    /\b(forecast|forecasting|projection|projected|future|next \d+|next month|next quarter|3 month|6 month|history|historical|trend|trending|changed|change over time|improving|worsening|declining|last month|last quarter|past \d+)\b/.test(value)
  ) {
    return 'historical_forecast'
  }

  return 'financial_position'
}
