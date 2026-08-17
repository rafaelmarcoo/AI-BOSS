import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthForm } from '@/components/auth-form'

const replace = jest.fn()
const refresh = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh }),
}))

describe('AuthForm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    window.sessionStorage.clear()
  })

  it('verifies the password before requesting a sign-in link', async () => {
    const user = userEvent.setup()
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    }) as jest.Mock

    render(<AuthForm mode="sign-in" />)
    await user.type(screen.getByLabelText(/^Email/), 'person@example.com')
    await user.type(screen.getByLabelText(/Password/), 'password123')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/check-email'))
    const [, request] = (global.fetch as jest.Mock).mock.calls[0]
    expect(JSON.parse(request.body)).toEqual({
      email: 'person@example.com',
      password: 'password123',
    })
    expect(window.sessionStorage.getItem('pending-signin-email')).toBe(
      'person@example.com'
    )
  })

  it('shows and uses the development-only email bypass when enabled', async () => {
    const user = userEvent.setup()
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    }) as jest.Mock

    render(<AuthForm mode="sign-in" showTestBypass />)

    expect(screen.getByText('Development testing only')).toBeInTheDocument()
    await user.type(screen.getByLabelText(/^Email/), 'person@example.com')
    await user.type(screen.getByLabelText(/Password/), 'password123')
    await user.click(screen.getByRole('button', { name: 'Bypass email check' }))

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/landing'))
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/auth/test-bypass',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('submits an admin with a newly entered company', async () => {
    const user = userEvent.setup()
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    }) as jest.Mock

    render(<AuthForm mode="sign-up" />)
    await user.click(screen.getByRole('button', { name: 'Create a company' }))
    await user.type(screen.getByRole('textbox', { name: /Company name/ }), 'Acme Ltd')
    await user.type(screen.getByLabelText(/Work email/), 'admin@example.com')
    await user.type(screen.getByLabelText(/Password/), 'password123')
    await user.type(screen.getByLabelText(/Confirm password/), 'password123')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    const [, request] = (global.fetch as jest.Mock).mock.calls[0]
    expect(JSON.parse(request.body)).toMatchObject({
      companyName: 'Acme Ltd',
      userType: 'admin',
    })
    expect(replace).toHaveBeenCalledWith('/verify-email')
  })

  it('uses the development signup bypass without requesting an email', async () => {
    const user = userEvent.setup()
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    }) as jest.Mock

    render(<AuthForm mode="sign-up" showTestBypass />)
    await user.click(screen.getByRole('button', { name: 'Create a company' }))
    await user.type(screen.getByRole('textbox', { name: /Company name/ }), 'Acme Ltd')
    await user.type(screen.getByLabelText(/Work email/), 'admin@example.com')
    await user.type(screen.getByLabelText(/^Password/), 'password123')
    await user.type(screen.getByLabelText(/Confirm password/), 'password123')
    await user.click(screen.getByRole('button', { name: 'Bypass signup email' }))

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/landing'))
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/auth/signup',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-ai-boss-test-bypass': 'true' }),
      })
    )
  })

  it('submits an employee company code without listing companies', async () => {
    const user = userEvent.setup()
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    }) as jest.Mock

    render(<AuthForm mode="sign-up" />)
    await user.click(screen.getByRole('button', { name: 'Join a company' }))
    await user.type(screen.getByLabelText(/Company code/), 'A3F9-7C21-D84B-6E10')
    await user.type(screen.getByLabelText(/Work email/), 'employee@example.com')
    await user.type(screen.getByLabelText(/Password/), 'password123')
    await user.type(screen.getByLabelText(/Confirm password/), 'password123')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    const [, request] = (global.fetch as jest.Mock).mock.calls[0]
    expect(JSON.parse(request.body)).toMatchObject({
      companyCode: 'A3F9-7C21-D84B-6E10',
      userType: 'employee',
    })
    expect(screen.queryByRole('combobox', { name: /Company/ })).not.toBeInTheDocument()
  })
})
