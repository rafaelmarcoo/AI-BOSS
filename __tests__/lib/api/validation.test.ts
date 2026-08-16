import {
  validateChatPayload,
  validateEmailPayload,
  validateSignInPayload,
  validateSignUpPayload,
} from '@/lib/api/validation'

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

describe('validateSignInPayload', () => {
  it('requires an email and password before the email confirmation step', () => {
    expect(
      validateSignInPayload({
        email: 'Person@Example.com',
        password: 'password123',
      })
    ).toEqual({
      success: true,
      data: { email: 'person@example.com', password: 'password123' },
    })
  })
})

describe('validateEmailPayload', () => {
  it('normalizes a valid email address', () => {
    expect(validateEmailPayload({ email: 'Person@Example.com' })).toEqual({
      success: true,
      data: { email: 'person@example.com' },
    })
  })

  it('rejects an invalid email address', () => {
    expect(validateEmailPayload({ email: 'not-an-email' })).toEqual({
      success: false,
      details: { email: 'email must be a valid email address.' },
    })
  })
})
