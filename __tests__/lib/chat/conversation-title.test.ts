import { createConversationTitle } from '@/lib/chat/conversation-title'

describe('createConversationTitle', () => {
  it('creates a runway-focused title without using the full raw question', () => {
    expect(
      createConversationTitle('What is my runway if monthly burn increases to 40000?')
    ).toBe('Runway: my runway if monthly burn increases to 40000')
  })

  it('creates a document-focused title for uploaded report questions', () => {
    expect(
      createConversationTitle(
        'What does the uploaded board report say about cash risk and next actions?'
      )
    ).toBe('Document insight: the uploaded board report: cash risk and next actions')
  })

  it('trims filler and truncates long generic prompts', () => {
    expect(
      createConversationTitle(
        'Can you please explain this long dashboard highlight with a lot of surrounding context that would otherwise overflow the thread list?'
      )
    ).toBe('this long dashboard highlight with a lot of surrounding context that ...')
  })
})
