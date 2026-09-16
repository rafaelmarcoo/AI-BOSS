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
  }

  it('accepts an admin signup with a company name', () => {
    expect(validateSignUpPayload({
      ...basePayload,
      userType: 'admin',
      companyName: 'Acme Ltd',
    })).toEqual({
      success: true,
      data: { ...basePayload, userType: 'admin', companyName: 'Acme Ltd' },
    })
  })

  it('accepts and normalizes an employee company code', () => {
    expect(validateSignUpPayload({
      ...basePayload,
      userType: 'employee',
      companyCode: 'a3f97c21d84b6e10',
    })).toEqual({
      success: true,
      data: {
        ...basePayload,
        userType: 'employee',
        companyCode: 'A3F9-7C21-D84B-6E10',
      },
    })
  })

  it('requires a supported user role', () => {
    expect(validateSignUpPayload({
      ...basePayload,
      userType: 'owner',
      companyName: 'Acme Ltd',
    })).toEqual({
      success: false,
      details: { userType: 'userType must be either "admin" or "employee".' },
    })
  })

  it('requires a company code for employees', () => {
    expect(
      validateSignUpPayload({
        email: basePayload.email,
        password: basePayload.password,
        userType: 'employee',
      })
    ).toEqual({
      success: false,
      details: { companyCode: 'companyCode is required.' },
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
