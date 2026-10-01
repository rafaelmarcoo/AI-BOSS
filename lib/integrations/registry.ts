import { ApiError } from '@/lib/api/errors'
import { FreeAgentAdapter } from '@/lib/integrations/adapters/freeagent'
import { FreshBooksAdapter } from '@/lib/integrations/adapters/freshbooks'
import { QuickBooksAdapter } from '@/lib/integrations/adapters/quickbooks'
import { XeroAdapter } from '@/lib/integrations/adapters/xero'
import { ZohoBooksAdapter } from '@/lib/integrations/adapters/zoho-books'
import type { AccountingAdapter, AccountingProvider } from '@/lib/integrations/types'

const adapters: Record<AccountingProvider, AccountingAdapter> = {
  xero: new XeroAdapter(),
  quickbooks: new QuickBooksAdapter(),
  freshbooks: new FreshBooksAdapter(),
  zoho_books: new ZohoBooksAdapter(),
  freeagent: new FreeAgentAdapter(),
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
