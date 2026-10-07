import { fireEvent, render, screen } from '@testing-library/react'
import { CompareWorkspace } from '@/app/dashboard/companies/compare/CompareWorkspace'
import { CIMA_CASE_STUDIES } from '@/lib/company-analysis/cima-case-studies'
import { compareCompanies, statementsFromCaseStudy } from '@/lib/company-analysis/statement-analysis'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
}))

jest.mock('@/app/dashboard/chat/sidebar', () => ({ ChatSidebar: () => null }))

const study = (name: string) => statementsFromCaseStudy(CIMA_CASE_STUDIES.find((company) => company.name === name)!)
const comparison = compareCompanies(study('Ressett'), study('Fixxupp'))

const companies = [
  { id: 'ressett', name: 'Ressett', industry: null, currency: 'L$', amountsIn: 'millions', source: 'CIMA', isOwn: false, competitors: ['Fixxupp'] },
  { id: 'fixxupp', name: 'Fixxupp', industry: null, currency: 'L$', amountsIn: 'millions', source: 'CIMA', isOwn: false, competitors: ['Ressett'] },
]
const compared = (id: string, name: string) => ({ id, name, source: 'CIMA', isOwn: false, fiscalYearEnd: '2025-03-31' })

beforeEach(() => {
  global.fetch = jest.fn(async (url: string) => ({
    json: async () =>
      String(url).startsWith('/api/companies/compare')
        ? { success: true, data: { comparison, companies: { first: compared('ressett', 'Ressett'), second: compared('fixxupp', 'Fixxupp') } } }
        : { success: true, data: { companies } },
  })) as unknown as typeof fetch
  window.print = jest.fn()
})

describe('Save as PDF on the Compare page', () => {
  it('opens the print dialog, with a report title and every working ready for the PDF', async () => {
    const { container } = render(<CompareWorkspace initialFirst="ressett" initialSecond="fixxupp" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Save as PDF' }))

    expect(window.print).toHaveBeenCalled()
    expect(screen.getByText('AI-BOSS comparison report: Ressett vs Fixxupp')).toBeInTheDocument()
    expect(container.querySelectorAll('.print-only-row')).toHaveLength(comparison.ratios.length)
    expect(container.textContent).toContain('Operating profit L$28.4m ÷ revenue L$203.3m × 100 = 14.0%')
  })

  it('hides the buttons and pickers from the PDF', async () => {
    const { container } = render(<CompareWorkspace initialFirst="ressett" initialSecond="fixxupp" />)
    const saveButton = await screen.findByRole('button', { name: 'Save as PDF' })

    expect(saveButton.closest('.no-print')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Swap companies' }).closest('.no-print')).not.toBeNull()
    expect(container.querySelector('.print-only')).not.toBeNull()
  })
})
