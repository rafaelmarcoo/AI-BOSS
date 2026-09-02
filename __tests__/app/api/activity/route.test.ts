/** @jest-environment node */

import { NextRequest } from 'next/server'
import { GET } from '@/app/api/activity/route'
import { requireAuthenticatedUser } from '@/lib/auth'
import { listRecentActivity } from '@/lib/activity/recent-activity'

jest.mock('@/lib/auth', () => ({ requireAuthenticatedUser: jest.fn() }))
jest.mock('@/lib/activity/recent-activity', () => ({ listRecentActivity: jest.fn() }))

const mockRequireAuthenticatedUser = jest.mocked(requireAuthenticatedUser)
const mockListRecentActivity = jest.mocked(listRecentActivity)

describe('GET /api/activity', () => {
  it('loads activity only through the authenticated user boundary', async () => {
    mockRequireAuthenticatedUser.mockResolvedValue({
      accessToken: 'token',
      user: { id: 'user-1', email: 'owner@example.com' },
    })
    mockListRecentActivity.mockResolvedValue([])

    const response = await GET(new NextRequest('http://localhost/api/activity'))

    expect(response.status).toBe(200)
    expect(mockListRecentActivity).toHaveBeenCalledWith('user-1')
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { activities: [] },
    })
  })
})
