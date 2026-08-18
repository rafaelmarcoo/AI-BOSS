import { render, screen } from '@testing-library/react'
import { DashboardHeader } from '@/app/dashboard/header'

jest.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}))

describe('DashboardHeader', () => {
  it('links the AI-BOSS brand back to the landing page', () => {
    render(<DashboardHeader />)

    expect(screen.getByRole('link', { name: 'AI-BOSS home' })).toHaveAttribute(
      'href',
      '/landing',
    )
  })
})
