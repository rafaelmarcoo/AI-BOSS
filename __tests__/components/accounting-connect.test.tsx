import { render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { AccountingConnect } from '@/components/accounting-connect'

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: jest.fn(),
  }),
}))

jest.mock('@/components/xero-connect', () => ({
  XeroConnect({ onStatusChange }: { onStatusChange?: () => void }) {
    useEffect(() => {
      onStatusChange?.()
    }, [onStatusChange])

    return (
      <button type="button" onClick={onStatusChange}>
        Xero connector
      </button>
    )
  },
}))

describe('AccountingConnect', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('loads accounting statuses without hiding the Xero connector', async () => {
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

    expect(await screen.findByText('Xero connector')).toBeInTheDocument()
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/integrations/status', {
        credentials: 'include',
      })
    })
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })
  })

  it('keeps the Xero connector available when status loading fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: { message: 'Nope' },
      }),
    }) as jest.Mock

    render(<AccountingConnect />)

    expect(await screen.findByText('Xero connector')).toBeInTheDocument()
    expect(
      await screen.findByText('Could not load accounting connection statuses.')
    ).toBeInTheDocument()
  })
})
