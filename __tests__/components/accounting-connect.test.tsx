import { render, screen, waitFor } from '@testing-library/react'
import { AccountingConnect } from '@/components/accounting-connect'

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: jest.fn(),
  }),
}))

describe('AccountingConnect', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('loads accounting statuses and shows Xero as connected', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          {
            provider: 'xero',
            status: 'connected',
            displayName: 'Demo Company NZ',
            connectedAt: '2026-05-12T00:00:00.000Z',
            lastSyncedAt: null,
          },
        ],
      }),
    }) as jest.Mock

    render(<AccountingConnect />)

    expect(await screen.findByText('Demo Company NZ')).toBeInTheDocument()
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/integrations/status', {
        credentials: 'include',
      })
    })
  })

  it('shows an error when status loading fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: { message: 'Nope' },
      }),
    }) as jest.Mock

    render(<AccountingConnect />)

    expect(
      await screen.findByText('Could not load accounting connection statuses.')
    ).toBeInTheDocument()
  })

  it('links the Connect button straight to the direct-OAuth connect route', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    }) as jest.Mock

    render(<AccountingConnect />)

    const connectLink = await screen.findByRole('link', { name: 'Connect' })
    expect(connectLink).toHaveAttribute('href', '/api/integrations/connect/xero')
  })
})
