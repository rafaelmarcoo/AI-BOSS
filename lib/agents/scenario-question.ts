export interface ScenarioNeedsInput {
  field?: string
  message: string
  options?: Array<{ sourceKey: string; sourceLabel: string; currency: string }>
}

export function scenarioQuestionFor(needs: ScenarioNeedsInput) {
  if (needs.field === 'source_currency') {
    const options = needs.options ?? []
    if (options.length === 0) {
      return "I couldn't find uploaded financial statements in NZD or AUD to base this scenario on. Which statement and currency should I use? You can upload one in the Documents tab."
    }
    return [
      'Which data should I use for this scenario?',
      '',
      ...options.map((option, index) => `${index + 1}. ${option.sourceLabel} (${option.currency})`),
      '',
      'Reply with the number or the file name.',
    ].join('\n')
  }

  // Already a question, or not from the calculator so we leave it as is
  if (!needs.field || needs.message.trim().endsWith('?')) return needs.message

  // Invalid input to the calculator: its message is technical, so we reword it to be a question for the user
  if (needs.field === 'assumptions') {
    return "Some of the scenario details weren't clear enough to calculate. Can you confirm the amount or percentage, whether it's one-off or recurring, and the start month?"
  }

  if (/\b(?:start|end) month\b/i.test(needs.message)) {
    return `I couldn't run this scenario yet: ${needs.message} Which start month should I use, and should it stop at an end month or keep going with no end date?`
  }

  return `I couldn't run this scenario yet: ${needs.message} Can you give me that detail so I can calculate it?`
}
