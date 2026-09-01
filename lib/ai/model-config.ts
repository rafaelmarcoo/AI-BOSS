export const DEFAULT_CHAT_MODEL = 'gpt-5.6-luna'
export const DEFAULT_UTILITY_MODEL = 'gpt-4o-mini-2024-07-18'

function modelFromEnvironment(value: string | undefined, fallback: string) {
  const configuredModel = value?.trim()
  return configuredModel || fallback
}

/**
 * Main reasoning and tool-calling model used by chat and generated UI planning.
 * Keeping this server-configurable lets us evaluate or roll back a model without
 * changing application code.
 */
export const CHAT_MODEL = modelFromEnvironment(
  process.env.OPENAI_CHAT_MODEL,
  DEFAULT_CHAT_MODEL
)

/** Lightweight model for cosmetic, non-financial tasks such as chat titles. */
export const UTILITY_MODEL = modelFromEnvironment(
  process.env.OPENAI_UTILITY_MODEL,
  DEFAULT_UTILITY_MODEL
)

/**
 * Low reasoning gives Luna a small reasoning budget for request interpretation
 * and tool selection without using its more expensive default medium setting.
 */
export function mainModelOptions() {
  return CHAT_MODEL === 'gpt-5.6-luna'
    ? { reasoning: { effort: 'none' as const } }
    : { temperature: 0 }
}
