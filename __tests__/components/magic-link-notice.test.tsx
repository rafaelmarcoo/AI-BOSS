import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MagicLinkNotice } from '@/components/magic-link-notice'

describe('MagicLinkNotice', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    window.sessionStorage.clear()
  })

  it('shows the destination and resends through the signin endpoint', async () => {
    const user = userEvent.setup()
    window.sessionStorage.setItem('pending-signin-email', 'person@example.com')
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, message: 'A new link was sent.' }),
    }) as jest.Mock

    render(<MagicLinkNotice />)

    expect(await screen.findByDisplayValue('person@example.com')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Resend sign-in link' }))
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/auth/email/resend-signin',
      expect.objectContaining({ body: JSON.stringify({ email: 'person@example.com' }) })
    )
  })
})
