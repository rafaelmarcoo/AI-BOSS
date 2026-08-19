export type FinancialSpecialist =
  | 'financial_position'
  | 'historical_forecast'
  | 'scenario'

export interface FinancialRoutingMessage {
  role: 'user' | 'assistant'
  content: string
}

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

export function routeFinancialQuestion(query: string): FinancialSpecialist {
  const value = normalize(query)

  if (
    /\b(what if|scenario|compare|hir(?:e|ed|ing)|fir(?:e|ed|ing)|dismiss(?:al|ed|ing)?|redundan(?:cy|t|cies)|new employee|staff|subscription|lease|equipment|loan|grant|funding|client|customer|cut|reduce|increase|decrease|grow|growth|save|saving|cost change|spend)\b/.test(value) ||
    /\b(burn|cost|expense|spend|revenue|sales|income)\b[^.?!]{0,40}%/.test(value)
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

export function routeFinancialConversation(
  query: string,
  history: FinancialRoutingMessage[] = []
): FinancialSpecialist {
  const direct = routeFinancialQuestion(query)
  if (direct !== 'financial_position') return direct

  const value = normalize(query)
  if (/\b(current cash|cash position|current runway|latest (?:cash|revenue|expenses|burn)|how much cash)\b/.test(value)) {
    return direct
  }

  const latestAssistant = [...history]
    .reverse()
    .find((message) => message.role === 'assistant')
  const isScenarioClarification = latestAssistant &&
    latestAssistant.content.includes('?') &&
    /\b(scenario|source\s*\/\s*currency|monthly employer cost|monthly saving|baseline|percentage|compounding|one-off|recurring|start month|timing|horizon)\b/i.test(latestAssistant.content)

  return isScenarioClarification ? 'scenario' : direct
}

export function getScenarioPreflightClarification(query: string) {
  const value = normalize(query)
  const salaryOnlyHire = routeFinancialQuestion(query) === 'scenario' &&
    /\b(hir(?:e|ed|ing)|employee|staff|worker|fir(?:e|ed|ing)|dismiss(?:al|ed|ing)?|redundan\w*)\b/.test(value) &&
    /\b(?:annual|annually|yearly|salary)\b/.test(value) &&
    !/\b(?:employer cost|total monthly|monthly saving|confirmed saving|per month|monthly)\b/.test(value)

  return salaryOnlyHire
    ? 'What is the confirmed total monthly employer cost or monthly saving to model? Please list recruitment, equipment, or redundancy costs separately as one-off cash adjustments.'
    : null
}
