export function companyChatQuestion(selection: string, companyNames: string[]) {
  const names = [...new Set(companyNames.filter((name) => name.trim() !== ''))]
  const about =
    names.length === 0
      ? 'About these competitors'
      : names.length === 1
        ? `About ${names[0]}`
        : `About ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`

  return `${about}: can you explain this?\n\n"${selection}"`
}

export function companyChatSuggestions(companyNames: string[]) {
  const names = [...new Set(companyNames.filter((name) => name.trim() !== ''))]
  if (names.length >= 2) {
    const [first, second] = names
    return [
      `Compare ${first} with ${second}`,
      `Which of ${first} and ${second} is safer if sales drop?`,
      `What should ${first}'s managers investigate next?`,
    ]
  }
  if (names.length === 1) {
    return [`Analyse ${names[0]}`, `Who are ${names[0]}'s competitors?`, `How is ${names[0]}'s debt changing?`]
  }
  return [
    'Compare Ressett with Fixxupp',
    'Which case study company is the most profitable?',
    "Who are Trimayr's competitors?",
  ]
}
