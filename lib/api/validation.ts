import { ApiError } from '@/lib/api/errors'

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; details: Record<string, string> }

export async function readJsonBody(request: Request) {
  try {
    return await request.json()
  } catch {
    throw new ApiError(400, 'BAD_REQUEST', 'Request body must be valid JSON.')
  }
}

export function assertValid<T>(result: ValidationResult<T>) {
  if (!result.success) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'Request validation failed.',
      result.details
    )
  }

  return result.data
}

function readTrimmedString(
  input: unknown,
  fieldName: string,
  details: Record<string, string>
) {
  if (typeof input !== 'string') {
    details[fieldName] = `${fieldName} is required.`
    return null
  }

  const trimmed = input.trim()

  if (!trimmed) {
    details[fieldName] = `${fieldName} is required.`
    return null
  }

  return trimmed
}

export interface SignUpPayload {
  email: string
  password: string
  fullName?: string
  companyName?: string
}

export interface SignInPayload {
  email: string
  password: string
}

export function validateSignUpPayload(payload: unknown): ValidationResult<SignUpPayload> {
  const details: Record<string, string> = {}
  const input = typeof payload === 'object' && payload !== null ? payload : {}

  const email = readTrimmedString(
    Reflect.get(input, 'email'),
    'email',
    details
  )
  const password = readTrimmedString(
    Reflect.get(input, 'password'),
    'password',
    details
  )
  const fullName = Reflect.get(input, 'fullName')
  const companyName = Reflect.get(input, 'companyName')

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    details.email = 'email must be a valid email address.'
  }

  if (password && password.length < 8) {
    details.password = 'password must be at least 8 characters long.'
  }

  if (fullName !== undefined && typeof fullName !== 'string') {
    details.fullName = 'fullName must be a string.'
  }

  if (companyName !== undefined && typeof companyName !== 'string') {
    details.companyName = 'companyName must be a string.'
  }

  if (Object.keys(details).length > 0 || !email || !password) {
    return {
      success: false,
      details,
    }
  }

  return {
    success: true,
    data: {
      email: email.toLowerCase(),
      password,
      ...(typeof fullName === 'string' && fullName.trim()
        ? { fullName: fullName.trim() }
        : {}),
      ...(typeof companyName === 'string' && companyName.trim()
        ? { companyName: companyName.trim() }
        : {}),
    },
  }
}

export function validateSignInPayload(payload: unknown): ValidationResult<SignInPayload> {
  const details: Record<string, string> = {}
  const input = typeof payload === 'object' && payload !== null ? payload : {}

  const email = readTrimmedString(
    Reflect.get(input, 'email'),
    'email',
    details
  )
  const password = readTrimmedString(
    Reflect.get(input, 'password'),
    'password',
    details
  )

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    details.email = 'email must be a valid email address.'
  }

  if (Object.keys(details).length > 0 || !email || !password) {
    return {
      success: false,
      details,
    }
  }

  return {
    success: true,
    data: {
      email: email.toLowerCase(),
      password,
    },
  }
}
