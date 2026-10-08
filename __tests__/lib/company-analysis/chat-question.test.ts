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

  it('changes after a chip is clicked and never repeats it', () => {
    const next = companyChatSuggestions(['Ressett', 'Fixxupp'], ['Compare Ressett with Fixxupp'])

    expect(next).toEqual([
      'Which of Ressett and Fixxupp is safer if sales drop?',
      'Which of Ressett and Fixxupp keeps more of each sale?',
      'Which of Ressett and Fixxupp is growing faster?',
    ])
  })

  it('follows the topic of the last question, here safety', () => {
    const next = companyChatSuggestions(['Ressett', 'Fixxupp'], ['Which of Ressett and Fixxupp is safer if sales drop?'])
    expect(next[0]).toBe('How much does Ressett rely on borrowing compared with Fixxupp?')
    expect(next).not.toContain('Which of Ressett and Fixxupp is safer if sales drop?')
  })

  it('reads the topic from a highlighted figure, here a margin', () => {
    const highlight = companyChatQuestion('Operating margin 14.0% 11.0%', ['Ressett', 'Fixxupp'])
    expect(companyChatSuggestions(['Ressett', 'Fixxupp'], [highlight])[0]).toBe("How do Ressett's and Fixxupp's running costs compare?")
  })

  it('learns from typed questions too', () => {
    expect(companyChatSuggestions(['Ressett', 'Fixxupp'], ['how long do their customers take to pay?'])[0]).toBe(
      "How quickly do Ressett's customers pay compared with Fixxupp's?"
    )
  })

  it('always offers three, even after many questions', () => {
    const asked: string[] = []
    for (let round = 0; round < 6; round += 1) {
      const next = companyChatSuggestions(['Ressett', 'Fixxupp'], asked)
      expect(next).toHaveLength(3)
      asked.push(next[0])
    }
  })

  it.each([
    ['the Companies page', [], []],
    ['the Compare page', ['Ressett', 'Fixxupp'], []],
    ['two uploaded companies', ['Kiwi Salons', 'momo new'], ['Kiwi Salons', 'momo new']],
    ['one uploaded company', ['Kiwi Salons'], ['Kiwi Salons']],
  ])('every suggestion on %s, in every topic, reaches the company analyst', (_case, onScreen, uploaded) => {
    const lastQuestions = ['', 'compare', 'is it safe', 'margins', 'growth', 'customers pay', 'dividends']
    for (const last of lastQuestions) {
      for (const suggestion of companyChatSuggestions(onScreen, last ? [last] : [])) {
        expect(routeFinancialQuestion(suggestion, uploaded)).toBe('company_analysis')
      }
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
