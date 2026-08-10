import { validateChatPayload, validateSignUpPayload } from '@/lib/api/validation'

describe('validateSignUpPayload', () => {
  const basePayload = {
    email: 'person@example.com',
    password: 'password123',
    companyName: 'Acme Ltd',
  }

  it.each(['admin', 'employee'] as const)('accepts the %s signup role', (userType) => {
    expect(validateSignUpPayload({ ...basePayload, userType })).toEqual({
      success: true,
      data: { ...basePayload, userType },
    })
  })

  it('requires a supported user role', () => {
    expect(validateSignUpPayload({ ...basePayload, userType: 'owner' })).toEqual({
      success: false,
      details: { userType: 'userType must be either "admin" or "employee".' },
    })
  })

  it('requires a company for every new account', () => {
    expect(
      validateSignUpPayload({
        email: basePayload.email,
        password: basePayload.password,
        userType: 'employee',
      })
    ).toEqual({
      success: false,
      details: { companyName: 'companyName is required.' },
    })
  })
})

describe('validateChatPayload visibility', () => {
  const messages = [{ role: 'user', content: 'Show my runway' }]

  it.each(['private', 'company', 'admins'] as const)(
    'accepts %s conversation visibility',
    (visibility) => {
      expect(validateChatPayload({ messages, visibility })).toMatchObject({
        success: true,
        data: { visibility },
      })
    }
  )

  it('rejects an unsupported visibility mode', () => {
    expect(validateChatPayload({ messages, visibility: 'public' })).toEqual({
      success: false,
      details: { visibility: 'visibility must be private, company, or admins.' },
    })
  })
})
