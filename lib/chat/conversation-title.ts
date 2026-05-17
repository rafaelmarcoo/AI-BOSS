const MAX_TITLE_LENGTH = 72

const TITLE_PREFIX_RULES: Array<[RegExp, string]> = [
  [/\brunway\b/i, 'Runway'],
  [/\b(hire|hiring|employee|staff|salary|wage)\b/i, 'Hiring scenario'],
  [/\b(document|pdf|report|csv|upload|file)\b/i, 'Document insight'],
  [/\b(cash flow|cash|burn|expense|revenue|receivable|payable)\b/i, 'Cash flow'],
  [/\b(source|where.*from|used)\b/i, 'Source check'],
  [/\b(missing|unavailable|not provided)\b/i, 'Missing metrics'],
  [/\bxero\b/i, 'Xero'],
]

function cleanMessageForTitle(message: string) {
  return message
    .replace(/\s+/g, ' ')
    .replace(/^can you\s+/i, '')
    .replace(/^please\s+/i, '')
    .replace(/^explain\s+/i, '')
    .replace(/[?!.\s]+$/g, '')
    .trim()
}

function truncateTitle(title: string) {
  return title.length > MAX_TITLE_LENGTH
    ? `${title.slice(0, MAX_TITLE_LENGTH - 3)}...`
    : title
}

export function createConversationTitle(message: string) {
  const cleaned = cleanMessageForTitle(message)

  if (!cleaned) {
    return null
  }

  const matchedRule = TITLE_PREFIX_RULES.find(([pattern]) =>
    pattern.test(cleaned)
  )

  if (!matchedRule) {
    return truncateTitle(cleaned)
  }

  const [, prefix] = matchedRule
  const withoutPrefixNoise = cleaned
    .replace(/^what (does|did) (.+?) say about /i, '$2: ')
    .replace(/^what\s+(is|are|does|do|did|happens to)\s+/i, '')
    .replace(/^why\s+(did|does|is|are)\s+/i, '')
    .replace(/^explain\s+/i, '')
    .trim()

  return truncateTitle(`${prefix}: ${withoutPrefixNoise}`)
}
