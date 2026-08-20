import { ChatOpenAI } from '@langchain/openai'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { ApiError } from '@/lib/api/errors'
import { CHAT_MODEL } from '@/lib/chat/system-prompt'

/**
 * Every provider here implements OpenAI's API format, so they all run through
 * ChatOpenAI with a different baseUrl and by adding a model is a config entry, not
 * new code.
 */

export interface ModelProvider {
  label: string
  apiKeyEnv: string
  sdk: 'openai' | 'google'
  baseUrl?: string
  docsUrl: string
}

export const MODEL_PROVIDERS = {
  openai: {
    label: 'OpenAI',
    apiKeyEnv: 'OPENAI_API_KEY',
    sdk: 'openai',
    docsUrl: 'https://platform.openai.com/docs/models',
  },
  zhipu: {
    label: 'Zhipu GLM',
    apiKeyEnv: 'ZHIPU_API_KEY',
    sdk: 'openai',
    baseUrl: 'https://api.z.ai/api/paas/v4',
    docsUrl: 'https://docs.z.ai',
  },
  deepseek: {
    label: 'DeepSeek',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    sdk: 'openai',
    baseUrl: 'https://api.deepseek.com',
    docsUrl: 'https://api-docs.deepseek.com',
  },
  xai: {
    label: 'xAI Grok',
    apiKeyEnv: 'XAI_API_KEY',
    sdk: 'openai',
    baseUrl: 'https://api.x.ai/v1',
    docsUrl: 'https://docs.x.ai/docs/models',
  },
  google: {
    label: 'Google Gemini',
    apiKeyEnv: 'GEMINI_API_KEY',
    sdk: 'google',
    docsUrl: 'https://ai.google.dev/gemini-api/docs',
  },
} as const satisfies Record<string, ModelProvider>

export type ProviderId = keyof typeof MODEL_PROVIDERS

export interface ModelSpec {
  provider: ProviderId
  model: string
  label: string
  /** Confirmed by a live API call. `npm run check:models` reports mismatches. */
  verified: boolean
}

export const MODEL_CATALOG = {
  'gpt-4o-mini': {
    provider: 'openai',
    model: CHAT_MODEL,
    label: 'GPT-4o mini',
    verified: true,
  },
  'gpt-4o': {
    provider: 'openai',
    model: 'gpt-4o',
    label: 'GPT-4o',
    verified: true,
  },
  // Run `npm run check:models`
  // once a key exists and correct any that fail.
  'glm-5.2': {
    provider: 'zhipu',
    model: 'glm-5.2',
    label: 'GLM-5.2',
    verified: true,
  },
  'glm-5.3': {
    provider: 'zhipu',
    model: 'glm-5.3',
    label: 'GLM-5.3',
    verified: true,
  },
  'glm-5-turbo': {
    provider: 'zhipu',
    model: 'glm-5-turbo',
    label: 'GLM-5 Turbo',
    verified: true,
  },
  'deepseek-flash': {
    provider: 'deepseek',
    model: 'deepseek-v4-flash',
    label: 'DeepSeek V4 Flash',
    verified: true,
  },
  'grok': {
    provider: 'xai',
    model: 'grok-4',
    label: 'Grok 4',
    verified: true,
  },
  'gemini-flash': {
    provider: 'google',
    model: 'gemini-3.6-flash',
    label: 'Gemini 3.6 Flash',
    verified: true,
  },
} as const satisfies Record<string, ModelSpec>

export type ModelName = keyof typeof MODEL_CATALOG

export const DEFAULT_MODEL: ModelName = 'gpt-4o-mini'

export const MODEL_NAMES = Object.keys(MODEL_CATALOG) as ModelName[]

export function isModelName(value: string): value is ModelName {
  return value in MODEL_CATALOG
}

export function resolveModel(name: ModelName) {
  const spec: ModelSpec = MODEL_CATALOG[name]
  const provider: ModelProvider = MODEL_PROVIDERS[spec.provider]

  return { spec, provider, apiKey: process.env[provider.apiKeyEnv] }
}

function buildModel(
  spec: ModelSpec,
  provider: ModelProvider,
  apiKey: string,
  temperature: number,
  maxRetries?: number
): BaseChatModel {
  if (provider.sdk === 'google') {
    return new ChatGoogleGenerativeAI({
      model: spec.model,
      temperature,
      apiKey,
      ...(maxRetries === undefined ? {} : { maxRetries }),
    })
  }

  return new ChatOpenAI({
    model: spec.model,
    temperature,
    apiKey,
    ...(maxRetries === undefined ? {} : { maxRetries }),
    ...(provider.baseUrl ? { configuration: { baseURL: provider.baseUrl } } : {}),
  })
}


export function createChatModel(
  name: ModelName = DEFAULT_MODEL,
  options: { temperature?: number; maxRetries?: number } = {}
) {
  const { spec, provider, apiKey } = resolveModel(name)

  if (!apiKey) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      `Missing required environment variable: ${provider.apiKeyEnv} (needed for ${spec.label}).`
    )
  }

  return buildModel(
    spec,
    provider,
    apiKey,
    options.temperature ?? 0,
    options.maxRetries
  )
}


export function tryCreateChatModel(
  name: ModelName = DEFAULT_MODEL,
  options: { temperature?: number } = {}
) {
  const { spec, provider, apiKey } = resolveModel(name)

  if (!apiKey) {
    return null
  }

  return buildModel(spec, provider, apiKey, options.temperature ?? 0)
}
