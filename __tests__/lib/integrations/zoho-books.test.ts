import { ZohoBooksAdapter } from '@/lib/integrations/adapters/zoho-books'

function jsonResponse(payload: unknown, ok = true) {
  return Promise.resolve({ ok, status: ok ? 200 : 400, json: async () => payload } as Response)
}

describe('Zoho Books regional OAuth safety', () => {
  beforeEach(() => {
    process.env.ZOHO_CLIENT_ID = 'client'
    process.env.ZOHO_CLIENT_SECRET = 'secret'
    process.env.ZOHO_REDIRECT_URI = 'http://localhost/callback'
  })

  afterEach(() => {
    jest.restoreAllMocks()
    delete process.env.ZOHO_CLIENT_ID
    delete process.env.ZOHO_CLIENT_SECRET
    delete process.env.ZOHO_REDIRECT_URI
  })

  it('rejects an unrecognised API domain before requesting organisation data', async () => {
    global.fetch = jest.fn(() => jsonResponse({
      access_token: 'access', refresh_token: 'refresh', expires_in: 3600,
      api_domain: 'https://attacker.example',
    })) as jest.Mock

    await expect(
      new ZohoBooksAdapter().exchangeCodeForTokens('code', 'state', { location: 'au' })
    ).rejects.toThrow('unsupported API domain')
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('retains the approved regional accounts domain when refreshing', async () => {
    global.fetch = jest.fn()
      .mockImplementationOnce(() => jsonResponse({
        access_token: 'access', refresh_token: 'refresh', expires_in: 3600,
        api_domain: 'https://www.zohoapis.com.au',
      }))
      .mockImplementationOnce(() => jsonResponse({
        organizations: [{ organization_id: 'org-1', name: 'Demo NZ', currency_code: 'NZD' }],
      }))
      .mockImplementationOnce(() => jsonResponse({ access_token: 'new-access', expires_in: 3600 }))

    const adapter = new ZohoBooksAdapter()
    const tokens = await adapter.exchangeCodeForTokens('code', 'state', { location: 'au' })
    await adapter.refreshAccessToken(tokens.refreshToken)

    expect(global.fetch).toHaveBeenNthCalledWith(
      3,
      'https://accounts.zoho.com.au/oauth/v2/token',
      expect.objectContaining({ method: 'POST' })
    )
  })
})
