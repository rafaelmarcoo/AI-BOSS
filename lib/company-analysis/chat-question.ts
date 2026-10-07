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

const SUGGESTION_POOLS = {
  start: ['Compare {A} with {B}', 'Which of {A} and {B} is safer if sales drop?', "What should {A}'s managers investigate next?"],
  comparison: ['Which of {A} and {B} is safer if sales drop?', 'Which of {A} and {B} keeps more of each sale?', 'Which of {A} and {B} is growing faster?'],
  safety: ['How much does {A} rely on borrowing compared with {B}?', 'Can {A} and {B} pay their short-term bills?', 'Which of {A} and {B} covers its interest more comfortably?'],
  profit: ["How do {A}'s and {B}'s running costs compare?", "Is {A}'s profit growing faster than its sales?", 'Which of {A} and {B} earns more on its capital?'],
  growth: ["Is {A}'s growth turning into profit?", "Where does {A}'s revenue come from?", 'How fast is {B} growing compared with {A}?'],
  efficiency: ["How quickly do {A}'s customers pay compared with {B}'s?", 'Which of {A} and {B} holds less stock?', 'How quickly does {A} pay its suppliers?'],
  payout: ['How much of its profit does {A} pay to its owners?', "Is {A}'s dividend leaving enough to reinvest?", "How do {A}'s and {B}'s payouts compare?"],
} as const

type Topic = keyof typeof SUGGESTION_POOLS

const TOPIC_WORDS: Array<[Topic, RegExp]> = [
  ['safety', /\b(safe|safer|liquid\w*|debt|gearing|borrow\w*|loans?|interest|current ratio|quick ratio|bills|cash)\b/],
  ['payout', /\b(dividends?|payout|owners)\b/],
  ['efficiency', /\b(days|stock|inventory|receivables?|payables?|turnover|suppliers|customers?|debtors|collect\w*|pay|paid)\b/],
  ['profit', /\b(profit\w*|margins?|costs?|roce|roe|returns?|capital|earns?|keeps more)\b/],
  ['growth', /\b(grow\w*|revenue|sales|streams?)\b/],
  ['comparison', /\b(compare|compared|vs|versus)\b/],
]

function topicOf(question: string): Topic {
  const text = question.toLowerCase()
  return TOPIC_WORDS.find(([, words]) => words.test(text))?.[0] ?? 'start'
}

const sameQuestion = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export function companyChatSuggestions(companyNames: string[], asked: string[] = []) {
  const names = [...new Set(companyNames.filter((name) => name.trim() !== ''))]

  if (names.length === 1) {
    const only = names[0]
    return [`Analyse ${only}`, `Who are ${only}'s competitors?`, `How is ${only}'s debt changing?`, `How is ${only}'s profit changing?`]
      .filter((question) => !asked.some((done) => sameQuestion(done, question)))
      .slice(0, 3)
  }

  const [first, second] = names.length >= 2 ? names : ['Ressett', 'Fixxupp']
  const fill = (template: string) => template.replaceAll('{A}', first).replaceAll('{B}', second)

  const lastTopic = asked.length > 0 ? topicOf(asked[asked.length - 1]) : 'start'
  const order: Topic[] = [lastTopic, 'comparison', 'safety', 'profit', 'growth', 'efficiency', 'payout', 'start']

  const picked: string[] = []
  for (const topic of order) {
    for (const template of SUGGESTION_POOLS[topic]) {
      const question = fill(template)
      const alreadyUsed = [...asked, ...picked].some((done) => sameQuestion(done, question))
      if (!alreadyUsed) picked.push(question)
      if (picked.length === 3) return picked
    }
  }
  return picked
}
