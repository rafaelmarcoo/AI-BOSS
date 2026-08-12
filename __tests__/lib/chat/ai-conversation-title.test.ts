import { sanitizeAiConversationTitle } from '@/lib/chat/ai-conversation-title'

describe('sanitizeAiConversationTitle', () => {
  it('removes model formatting and preserves a concise title', () => {
    expect(sanitizeAiConversationTitle('Title: "Cash runway risk review"')).toBe(
      'Cash runway risk review'
    )
  })

  it('limits titles to the UI-safe maximum length', () => {
    const title = sanitizeAiConversationTitle('A'.repeat(60))

    expect(title).toHaveLength(48)
  })

  it('returns null for blank model output', () => {
    expect(sanitizeAiConversationTitle('   ')).toBeNull()
  })
})
