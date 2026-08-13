import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthForm } from '@/components/auth-form'

const replace = jest.fn()
const refresh = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh }),
}))

describe('AuthForm signup roles', () => {
  beforeEach(() => jest.clearAllMocks())

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
    expect(replace).toHaveBeenCalledWith('/landing')
  })

  it('loads companies and submits the selected employee company', async () => {
    const user = userEvent.setup()
    global.fetch = jest.fn().mockImplementation(async (input: string) => {
      if (input === '/api/auth/companies') {
        return {
          ok: true,
          json: async () => ({ success: true, data: { companies: ['Acme Ltd'] } }),
        }
      }
      return { ok: true, json: async () => ({ success: true }) }
    }) as jest.Mock

    render(<AuthForm mode="sign-up" />)
    await user.click(screen.getByRole('button', { name: 'Join a company' }))
    await user.click(await screen.findByRole('combobox', { name: /Company/ }))
    await user.click(await screen.findByRole('option', { name: 'Acme Ltd' }))
    await user.type(screen.getByLabelText(/Work email/), 'employee@example.com')
    await user.type(screen.getByLabelText(/Password/), 'password123')
    await user.type(screen.getByLabelText(/Confirm password/), 'password123')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2))
    const [, request] = (global.fetch as jest.Mock).mock.calls[1]
    expect(JSON.parse(request.body)).toMatchObject({
      companyName: 'Acme Ltd',
      userType: 'employee',
    })
  })
})
