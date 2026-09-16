/** @jest-environment node */

import { NextRequest } from 'next/server'
import { GET, PUT } from '@/app/api/settings/gen-ui/route'
import { requireAuthenticatedUser } from '@/lib/auth'
import {
  getGenUiPersonalization,
  updateGenUiPersonalization,
} from '@/lib/gen-ui/preferences-persistence'

jest.mock('@/lib/auth', () => ({ requireAuthenticatedUser: jest.fn() }))
jest.mock('@/lib/gen-ui/preferences-persistence', () => ({
  getGenUiPersonalization: jest.fn(),
  updateGenUiPersonalization: jest.fn(),
}))

const mockAuth = jest.mocked(requireAuthenticatedUser)
const mockGetPreferences = jest.mocked(getGenUiPersonalization)
const mockUpdatePreferences = jest.mocked(updateGenUiPersonalization)

const preferences = {
  businessSize: 'small' as const,
  canEditBusinessSize: true,
  decisionRole: 'owner' as const,
  priorityTopics: ['cash_runway'] as const,
  detailLevel: 'balanced' as const,
  planningHorizon: 6 as const,
  learnFromHistory: false,
}

describe('Gen UI personalization API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue({
      accessToken: 'token',
      user: { id: 'user-1', email: 'owner@example.com' },
    })
    mockGetPreferences.mockResolvedValue({
      ...preferences,
      priorityTopics: [...preferences.priorityTopics],
    })
    mockUpdatePreferences.mockResolvedValue({
      ...preferences,
      priorityTopics: [...preferences.priorityTopics],
    })
  })

  it('returns preferences for the authenticated user', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/settings/gen-ui')
    )

    expect(response.status).toBe(200)
    expect(mockGetPreferences).toHaveBeenCalledWith('user-1')
  })

  it('validates and updates only the authenticated user preferences', async () => {
    const input = {
      businessSize: 'small',
      decisionRole: 'finance',
      priorityTopics: ['forecasting', 'cost_control'],
      detailLevel: 'quick',
      planningHorizon: 3,
      learnFromHistory: false,
    }
    const response = await PUT(
      new NextRequest('http://localhost/api/settings/gen-ui', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
    )

    expect(response.status).toBe(200)
    expect(mockUpdatePreferences).toHaveBeenCalledWith('user-1', input)
  })

  it('rejects more than three focus areas', async () => {
    const response = await PUT(
      new NextRequest('http://localhost/api/settings/gen-ui', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessSize: 'small',
          decisionRole: 'owner',
          priorityTopics: [
            'cash_runway',
            'growth',
            'cost_control',
            'forecasting',
          ],
          detailLevel: 'balanced',
          planningHorizon: 6,
          learnFromHistory: false,
        }),
      })
    )

    expect(response.status).toBe(400)
    expect(mockUpdatePreferences).not.toHaveBeenCalled()
  })
})
