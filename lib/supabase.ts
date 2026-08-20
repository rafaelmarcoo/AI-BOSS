import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function requireEnv(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

export const COOKIE_ACCESS_TOKEN = 'ai-boss-access-token'
export const COOKIE_REFRESH_TOKEN = 'ai-boss-refresh-token'
export const COOKIE_MAGIC_LINK_STATE = 'ai-boss-magic-link-state'
export const COOKIE_SIGNUP_STATE = 'ai-boss-signup-state'

const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL', supabaseUrl)
const anonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', supabaseAnonKey)

export function createBrowserSupabaseClient() {
  return createClient(url, anonKey)
}

export function createServerSupabaseClient() {
  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export function createAdminSupabaseClient() {
  return createClient(
    url,
    requireEnv('SUPABASE_SERVICE_ROLE_KEY', supabaseServiceRoleKey),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
