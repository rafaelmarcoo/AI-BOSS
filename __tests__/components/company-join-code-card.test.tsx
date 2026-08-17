import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CompanyJoinCodeCard } from '@/app/dashboard/settings/CompanyJoinCodeCard'

const refresh = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

describe('CompanyJoinCodeCard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows and copies the current admin join code', async () => {
    const user = userEvent.setup()
    const writeText = jest.spyOn(navigator.clipboard, 'writeText')
    render(
      <CompanyJoinCodeCard
        code="A3F9-7C21-D84B-6E10"
        expiresAt={new Date(Date.now() + 60 * 60 * 1000).toISOString()}
      />
    )

    expect(screen.getByText('Employee join code')).toBeInTheDocument()
    expect(screen.getByText('A3F9-7C21-D84B-6E10')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Copy code' }))

    expect(writeText).toHaveBeenCalledWith('A3F9-7C21-D84B-6E10')
    expect(await screen.findByText('Company code copied.')).toBeInTheDocument()
  })
})
