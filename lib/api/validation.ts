import { ApiError } from '@/lib/api/errors'
import { isModelName, type ModelName } from '@/lib/ai/models'
import type { ConversationVisibility, UserType } from '@/types/database'

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
  companyName: string
  userType: UserType
}

export interface SignInPayload {
  email: string
  password: string
}

// Keep the accepted chat roles narrow so the API contract stays predictable.
export type ChatMessageRole = 'user' | 'assistant'

export interface ChatMessagePayload {
  role: ChatMessageRole
  content: string
}

export interface ChatPayload {
  conversationId?: string
  visibility?: ConversationVisibility
  model?: ModelName
  messages: ChatMessagePayload[]
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
  const companyName = readTrimmedString(
    Reflect.get(input, 'companyName'),
    'companyName',
    details
  )
  const userType = Reflect.get(input, 'userType')

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    details.email = 'email must be a valid email address.'
  }

  if (password && password.length < 8) {
    details.password = 'password must be at least 8 characters long.'
  }

  if (fullName !== undefined && typeof fullName !== 'string') {
    details.fullName = 'fullName must be a string.'
  }

  if (userType !== 'admin' && userType !== 'employee') {
    details.userType = 'userType must be either "admin" or "employee".'
  }

  if (
    Object.keys(details).length > 0 ||
    !email ||
    !password ||
    !companyName ||
    (userType !== 'admin' && userType !== 'employee')
  ) {
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
      companyName,
      userType,
      ...(typeof fullName === 'string' && fullName.trim()
        ? { fullName: fullName.trim() }
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

export function validateChatPayload(payload: unknown): ValidationResult<ChatPayload> {
  const details: Record<string, string> = {}
  const input = typeof payload === 'object' && payload !== null ? payload : {}
  const rawMessages = Reflect.get(input, 'messages')
  const rawConversationId = Reflect.get(input, 'conversationId')
  const rawVisibility = Reflect.get(input, 'visibility')
  const rawModel = Reflect.get(input, 'model')

  // Reject early if the caller sends the wrong top-level shape.
  if (!Array.isArray(rawMessages)) {
    details.messages = 'messages must be an array.'
    return {
      success: false,
      details,
    }
  }

  if (rawMessages.length === 0) {
    details.messages = 'messages must contain at least one message.'
  }

  // Build a sanitized messages array while collecting field-specific validation errors.
  const messages = rawMessages.flatMap((message, index) => {
    if (typeof message !== 'object' || message === null) {
      details[`messages.${index}`] = 'Each message must be an object.'
      return []
    }

    const role = Reflect.get(message, 'role')
    const content = readTrimmedString(
      Reflect.get(message, 'content'),
      `messages.${index}.content`,
      details
    )

    if (role !== 'user' && role !== 'assistant') {
      details[`messages.${index}.role`] = 'role must be either "user" or "assistant".'
      return []
    }

    if (!content) {
      return []
    }

    return [
      {
        role,
        content,
      },
    ]
  })

  // If any message failed validation, do not return a partial conversation.
  if (Object.keys(details).length > 0 || messages.length !== rawMessages.length) {
    return {
      success: false,
      details,
    }
  }

  if (
    rawConversationId !== undefined &&
    (typeof rawConversationId !== 'string' || !rawConversationId.trim())
  ) {
    details.conversationId = 'conversationId must be a non-empty string.'
  }

  if (
    rawVisibility !== undefined &&
    rawVisibility !== 'private' &&
    rawVisibility !== 'company' &&
    rawVisibility !== 'admins'
  ) {
    details.visibility = 'visibility must be private, company, or admins.'
  }

  if (
    rawModel !== undefined &&
    (typeof rawModel !== 'string' || !isModelName(rawModel))
  ) {
    details.model = 'model must be a known model name.'
  }

  if (Object.keys(details).length > 0) {
    return {
      success: false,
      details,
    }
  }

  return {
    success: true,
    data: {
      ...(typeof rawConversationId === 'string' && rawConversationId.trim()
        ? { conversationId: rawConversationId.trim() }
        : {}),
      ...(rawVisibility === 'private' ||
      rawVisibility === 'company' ||
      rawVisibility === 'admins'
        ? { visibility: rawVisibility }
        : {}),
      ...(typeof rawModel === 'string' && isModelName(rawModel)
        ? { model: rawModel }
        : {}),
      messages,
    },
  }
}
