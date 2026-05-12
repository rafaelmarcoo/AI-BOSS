/**
 * @jest-environment node
 */

import { decryptToken, encryptToken } from '@/lib/xero/crypto'

describe('Xero token encryption', () => {
  const originalKey = process.env.TOKEN_ENCRYPTION_KEY

  beforeEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
  })

  afterAll(() => {
    process.env.TOKEN_ENCRYPTION_KEY = originalKey
  })

  it('round-trips a token without storing it as plaintext', async () => {
    const encrypted = await encryptToken('xero-refresh-token')

    expect(encrypted).not.toContain('xero-refresh-token')
    expect(await decryptToken(encrypted)).toBe('xero-refresh-token')
  })

  it('uses a random IV for each encryption', async () => {
    const first = await encryptToken('same-token')
    const second = await encryptToken('same-token')

    expect(first).not.toBe(second)
  })

  it('requires a 64-character hex encryption key', async () => {
    process.env.TOKEN_ENCRYPTION_KEY = 'not-a-valid-key'

    await expect(encryptToken('token')).rejects.toThrow(
      'TOKEN_ENCRYPTION_KEY must be a 64-character hex string'
    )
  })
})
