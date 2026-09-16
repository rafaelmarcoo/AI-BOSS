import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VerifyEmailNotice } from '@/components/verify-email-notice'

describe('VerifyEmailNotice', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    window.sessionStorage.clear()
  })

  it('tells the user to follow the verification link', async () => {
    window.sessionStorage.setItem('pending-signup-email', 'person@example.com')

    render(<VerifyEmailNotice />)

    expect(await screen.findByDisplayValue('person@example.com')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Check your email' })).toBeInTheDocument()
    expect(screen.getByText(/click the link to verify your address/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to sign in' })).toHaveAttribute(
      'href',
      '/sign-in'
    )
  })

  it('can resend the verification email', async () => {
    const user = userEvent.setup()
    window.sessionStorage.setItem('pending-signup-email', 'person@example.com')
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, message: 'A new email was sent.' }),
    }) as jest.Mock

    render(<VerifyEmailNotice />)
    await screen.findByDisplayValue('person@example.com')
    await user.click(screen.getByRole('button', { name: 'Resend verification email' }))

    expect(await screen.findByText('A new email was sent.')).toBeInTheDocument()
  })
})
