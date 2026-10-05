import { routeFinancialQuestion } from '@/lib/agents/router'
import { companyChatQuestion } from '@/lib/company-analysis/chat-question'

describe('companyChatQuestion', () => {
  it('names the companies being compared', () => {
    expect(companyChatQuestion('14.0% 11.0%', ['Ressett', 'Fixxupp'])).toBe(
      'About Ressett and Fixxupp: can you explain this?\n\n"14.0% 11.0%"'
    )
  })

  it('falls back to "competitors" when no company is named on screen', () => {
    expect(companyChatQuestion('Competes with Fixxupp', [])).toBe(
      'About these competitors: can you explain this?\n\n"Competes with Fixxupp"'
    )
  })

  it.each([
    ['two case studies', ['Ressett', 'Fixxupp'], []],
    ['an uploaded company', ['Kiwi Salons'], ['Kiwi Salons']],
    ['nothing named on screen', [], []],
  ])('reaches the company analyst for %s, not the own-business agent', (_case, onScreen, uploaded) => {
    const question = companyChatQuestion('Current ratio 2.46 1.80', onScreen)
    expect(routeFinancialQuestion(question, uploaded)).toBe('company_analysis')
  })
})
