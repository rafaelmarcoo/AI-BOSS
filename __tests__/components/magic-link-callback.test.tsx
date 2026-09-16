import { render, waitFor } from '@testing-library/react'
import { MagicLinkCallback } from '@/components/magic-link-callback'

const replace = jest.fn()
const refresh = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh }),
}))

describe('MagicLinkCallback', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    window.sessionStorage.clear()
  })

  it('exchanges link tokens for the app session', async () => {
    window.history.pushState(
      {},
      '',
      '/auth/callback?flow=signup#access_token=access&refresh_token=refresh'
    )
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    }) as jest.Mock

    render(<MagicLinkCallback />)

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/landing'))
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/auth/magic-link/session',
      expect.objectContaining({
        body: JSON.stringify({
          accessToken: 'access',
          refreshToken: 'refresh',
          flow: 'signup',
        }),
      })
    )
    expect(window.location.hash).toBe('')
  })
})
