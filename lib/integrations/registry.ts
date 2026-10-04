import { ApiError } from '@/lib/api/errors'
import { FreshBooksAdapter } from '@/lib/integrations/adapters/freshbooks'
import { FreeAgentAdapter } from '@/lib/integrations/adapters/freeagent'
import { MyobAdapter } from '@/lib/integrations/adapters/myob'
import { QuickBooksAdapter } from '@/lib/integrations/adapters/quickbooks'
import { XeroAdapter } from '@/lib/integrations/adapters/xero'
import { ZohoBooksAdapter } from '@/lib/integrations/adapters/zoho-books'
import type { AccountingAdapter, AccountingProvider } from '@/lib/integrations/types'

const adapters: Record<AccountingProvider, AccountingAdapter> = {
  xero: new XeroAdapter(),
  quickbooks: new QuickBooksAdapter(),
  freshbooks: new FreshBooksAdapter(),
  myob: new MyobAdapter(),
  zoho_books: new ZohoBooksAdapter(),
  freeagent: new FreeAgentAdapter(),
}

const requiredEnvironment: Record<AccountingProvider, string[]> = {
  xero: ['XERO_CLIENT_ID', 'XERO_CLIENT_SECRET', 'XERO_REDIRECT_URI'],
  quickbooks: [
    'QUICKBOOKS_CLIENT_ID',
    'QUICKBOOKS_CLIENT_SECRET',
    'QUICKBOOKS_REDIRECT_URI',
  ],
  freshbooks: [
    'FRESHBOOKS_CLIENT_ID',
    'FRESHBOOKS_CLIENT_SECRET',
    'FRESHBOOKS_REDIRECT_URI',
  ],
  myob: ['MYOB_CLIENT_ID', 'MYOB_CLIENT_SECRET', 'MYOB_REDIRECT_URI'],
  zoho_books: ['ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET', 'ZOHO_REDIRECT_URI'],
  freeagent: [
    'FREEAGENT_CLIENT_ID',
    'FREEAGENT_CLIENT_SECRET',
    'FREEAGENT_REDIRECT_URI',
  ],
}

export function getAdapter(provider: string): AccountingAdapter {
  const adapter = adapters[provider as AccountingProvider]

  if (!adapter) {
    throw new ApiError(400, 'VALIDATION_ERROR', `Unsupported provider: ${provider}`)
  }

  return adapter
}

export function listProviders(): AccountingProvider[] {
  return Object.keys(adapters) as AccountingProvider[]
}

export function isProviderConfigured(provider: AccountingProvider) {
  return requiredEnvironment[provider].every((key) => Boolean(process.env[key]))
}

export function requireProviderConfigured(provider: AccountingProvider) {
  if (!isProviderConfigured(provider)) {
    throw new ApiError(
      503,
      'INTERNAL_ERROR',
      `${adapters[provider].label} is not configured on this deployment.`
    )
  }
}
