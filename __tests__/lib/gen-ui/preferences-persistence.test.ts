/** @jest-environment node */

import { getUserCompany } from '@/lib/companies'
import { updateGenUiPersonalization } from '@/lib/gen-ui/preferences-persistence'
import { createAdminSupabaseClient } from '@/lib/supabase'

jest.mock('@/lib/companies', () => ({ getUserCompany: jest.fn() }))
jest.mock('@/lib/supabase', () => ({ createAdminSupabaseClient: jest.fn() }))

const mockGetUserCompany = jest.mocked(getUserCompany)
const mockCreateAdminClient = jest.mocked(createAdminSupabaseClient)

describe('Gen UI preference persistence', () => {
  beforeEach(() => jest.clearAllMocks())

  it('does not let an employee change the shared business size', async () => {
    mockGetUserCompany.mockResolvedValue({
      id: 'company-1',
      name: 'Acme',
      userType: 'employee',
    })
    const single = jest.fn().mockResolvedValue({
      data: { business_size: 'small' },
      error: null,
    })
    const eq = jest.fn().mockReturnValue({ single })
    const select = jest.fn().mockReturnValue({ eq })
    const from = jest.fn().mockReturnValue({ select })
    mockCreateAdminClient.mockReturnValue({ from } as unknown as ReturnType<
      typeof createAdminSupabaseClient
    >)

    await expect(
      updateGenUiPersonalization('user-1', {
        businessSize: 'large',
        decisionRole: 'finance',
        priorityTopics: ['forecasting'],
        detailLevel: 'balanced',
        planningHorizon: 6,
        learnFromHistory: false,
      })
    ).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    })
  })
})
