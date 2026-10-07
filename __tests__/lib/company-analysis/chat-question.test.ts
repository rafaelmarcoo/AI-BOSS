import { routeFinancialQuestion } from '@/lib/agents/router'
import { companyChatQuestion, companyChatSuggestions } from '@/lib/company-analysis/chat-question'

describe('companyChatSuggestions', () => {
  it('suggests questions about the two companies being compared', () => {
    expect(companyChatSuggestions(['Ressett', 'Fixxupp'])).toEqual([
      'Compare Ressett with Fixxupp',
      'Which of Ressett and Fixxupp is safer if sales drop?',
      "What should Ressett's managers investigate next?",
    ])
  })

  it.each([
    ['the Companies page', [], []],
    ['the Compare page', ['Ressett', 'Fixxupp'], []],
    ['one uploaded company', ['Kiwi Salons'], ['Kiwi Salons']],
  ])('every suggestion on %s reaches the company analyst', (_case, onScreen, uploaded) => {
    for (const suggestion of companyChatSuggestions(onScreen)) {
      expect(routeFinancialQuestion(suggestion, uploaded)).toBe('company_analysis')
    }
  })
})

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
