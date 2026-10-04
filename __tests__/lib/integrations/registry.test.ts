import {
  getAdapter,
  isProviderConfigured,
  listProviders,
  requireProviderConfigured,
} from '@/lib/integrations/registry'

describe('accounting provider registry', () => {
  afterEach(() => {
    delete process.env.ZOHO_CLIENT_ID
    delete process.env.ZOHO_CLIENT_SECRET
    delete process.env.ZOHO_REDIRECT_URI
  })

  it('retains MYOB and registers Zoho Books and FreeAgent', () => {
    expect(listProviders()).toEqual([
      'xero',
      'quickbooks',
      'freshbooks',
      'myob',
      'zoho_books',
      'freeagent',
    ])
    expect(getAdapter('myob').label).toBe('MYOB')
    expect(getAdapter('zoho_books').label).toBe('Zoho Books')
    expect(getAdapter('freeagent').label).toBe('FreeAgent')
  })

  it('marks providers unavailable until every server credential is present', () => {
    expect(isProviderConfigured('zoho_books')).toBe(false)
    expect(() => requireProviderConfigured('zoho_books')).toThrow(
      'Zoho Books is not configured on this deployment.'
    )

    process.env.ZOHO_CLIENT_ID = 'client'
    process.env.ZOHO_CLIENT_SECRET = 'secret'
    process.env.ZOHO_REDIRECT_URI = 'http://localhost/callback'

    expect(isProviderConfigured('zoho_books')).toBe(true)
    expect(() => requireProviderConfigured('zoho_books')).not.toThrow()
  })
})
