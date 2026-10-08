/** @jest-environment node */

import { NextRequest } from 'next/server'
import { GET as downloadCombined } from '@/app/api/financial-data/combined-csv/route'
import { routeFinancialConversation, routeFinancialQuestion } from '@/lib/agents/router'
import { ApiError } from '@/lib/api/errors'
import { requireAuthenticatedUser } from '@/lib/auth'
import { listFinancialMetricObservations } from '@/lib/financial-data/persistence'
import { createCombineFinancialSourcesTool } from '@/lib/tools/financial/combine-financial-sources'
import type { FinancialMetricObservation } from '@/types/database'

jest.mock('@/lib/auth', () => ({
  requireAuthenticatedUser: jest.fn(),
}))

jest.mock('@/lib/financial-data/persistence', () => ({
  listFinancialMetricObservations: jest.fn(),
}))

const rows = [
  { metric_key: 'cash', value: 185000, currency: 'NZD', as_of_date: '2026-05-18', period_start: null, period_end: null, source_label: 'financial-data.csv', created_at: '2026-09-10T00:00:00Z' },
  { metric_key: 'cash', value: 215000, currency: 'NZD', as_of_date: '2026-06-30', period_start: null, period_end: null, source_label: 'ai-boss-demo-full-statements.csv', created_at: '2026-09-17T00:00:00Z' },
] as FinancialMetricObservation[]

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(requireAuthenticatedUser).mockResolvedValue({
    accessToken: 'access-token',
    user: { id: 'user-1', email: 'owner@example.com' },
  } as Awaited<ReturnType<typeof requireAuthenticatedUser>>)
  jest.mocked(listFinancialMetricObservations).mockResolvedValue(rows)
})

describe('GET /api/financial-data/combined-csv', () => {
  it("downloads the signed-in user's figures as one CSV", async () => {
    const response = await downloadCombined(new NextRequest('http://localhost/api/financial-data/combined-csv'))

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/csv')
    expect(response.headers.get('Content-Disposition')).toMatch(/^attachment; filename="ai-boss-combined-data-\d{4}-\d{2}-\d{2}\.csv"$/)
    expect(await response.text()).toContain('Cash,215000,NZD,2026-06-30,ai-boss-demo-full-statements.csv')
    expect(listFinancialMetricObservations).toHaveBeenCalledWith('user-1')
  })

  it('answers 404 when there is nothing to combine', async () => {
    jest.mocked(listFinancialMetricObservations).mockResolvedValue([])
    expect((await downloadCombined(new NextRequest('http://localhost/api/financial-data/combined-csv'))).status).toBe(404)
  })

  it('requires sign-in', async () => {
    jest.mocked(requireAuthenticatedUser).mockRejectedValue(new ApiError(401, 'AUTH_REQUIRED', 'Authentication is required.'))
    expect((await downloadCombined(new NextRequest('http://localhost/api/financial-data/combined-csv'))).status).toBe(401)
  })
})

describe('asking the chat to combine files', () => {
  it.each([
    'Combine my files into one CSV',
    'Can you merge my three files into one file?',
    'Join all my data into a single csv please',
  ])('sends %p to the agent that has the combine tool', (question) => {
    // Own-business questions go to the general agent, which has combine_financial_sources.
    expect(routeFinancialQuestion(question)).toBe('financial_position')
  })

  it.each(['1 and 3', 'all', 'financial-data.csv and the consistent one'])(
    'keeps the answer %p with the same agent after it asks which files',
    (reply) => {
      const history = [
        { role: 'user' as const, content: 'Combine my files into one CSV' },
        {
          role: 'assistant' as const,
          content: 'Which files should I combine?\n\n1. a.csv (6 figures, 31 Mar 2026)\n2. b.csv (2 figures, 18 May 2026)\n\nReply with the numbers (for example "1 and 3"), the file names, or "all".',
        },
      ]
      expect(routeFinancialConversation(reply, history)).toBe('financial_position')
    }
  )
})

describe('choosing which files to combine', () => {
  const threeFiles = [
    ...rows,
    { metric_key: 'cash', value: 100000, currency: 'NZD', as_of_date: '2026-03-31', period_start: null, period_end: null, source_label: 'ai-boss-demo-consistent.csv', created_at: '2026-09-01T00:00:00Z' },
  ] as FinancialMetricObservation[]

  beforeEach(() => jest.mocked(listFinancialMetricObservations).mockResolvedValue(threeFiles))

  it('asks which files to combine before combining anything', async () => {
    const text = await createCombineFinancialSourcesTool('user-1').handler({})

    expect(listFinancialMetricObservations).toHaveBeenCalledWith('user-1')
    expect(text).toBe(
      [
        'Which files should I combine?',
        '',
        '1. ai-boss-demo-consistent.csv (1 figure, 31 Mar 2026)',
        '2. ai-boss-demo-full-statements.csv (1 figure, 30 Jun 2026)',
        '3. financial-data.csv (1 figure, 18 May 2026)',
        '',
        'Reply with the numbers (for example "1 and 3"), the file names, or "all".',
      ].join('\n')
    )
    expect(text).not.toContain('Download')
  })

  it('combines only the chosen files, and the link downloads only those', async () => {
    const text = await createCombineFinancialSourcesTool('user-1').handler({
      sources: ['AI-BOSS-DEMO-CONSISTENT.CSV', 'financial-data.csv'],
    })

    expect(text).toContain('Combined 2 figures from 2 sources into one CSV:')
    expect(text).not.toContain('full-statements')
    expect(text).toContain(
      '[Download combined CSV](/api/financial-data/combined-csv?source=ai-boss-demo-consistent.csv&source=financial-data.csv)'
    )
  })

  it('combines everything when the user says all', async () => {
    const text = await createCombineFinancialSourcesTool('user-1').handler({ all: true })

    expect(text).toContain('Combined 3 figures from 3 sources into one CSV:')
    expect(text).toContain('[Download combined CSV](/api/financial-data/combined-csv)')
  })

  it('says which name it could not find and lists the files again', async () => {
    const text = await createCombineFinancialSourcesTool('user-1').handler({ sources: ['budget.csv', 'financial-data.csv'] })

    expect(text).toContain('I couldn\'t find "budget.csv".')
    expect(text).toContain('Which files should I combine?')
  })

  it('needs at least two files', async () => {
    const text = await createCombineFinancialSourcesTool('user-1').handler({ sources: ['financial-data.csv'] })
    expect(text).toContain('Pick at least two files to combine.')
  })

  it('downloads only the files named in the link', async () => {
    const response = await downloadCombined(
      new NextRequest('http://localhost/api/financial-data/combined-csv?source=financial-data.csv&source=ai-boss-demo-consistent.csv')
    )
    const csv = await response.text()

    expect(csv).toContain('financial-data.csv')
    expect(csv).toContain('ai-boss-demo-consistent.csv')
    expect(csv).not.toContain('ai-boss-demo-full-statements.csv')
  })
})
