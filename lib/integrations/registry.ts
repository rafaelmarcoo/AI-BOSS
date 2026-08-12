import { ApiError } from '@/lib/api/errors'
import { FreshBooksAdapter } from '@/lib/integrations/adapters/freshbooks'
import { MyobAdapter } from '@/lib/integrations/adapters/myob'
import { QuickBooksAdapter } from '@/lib/integrations/adapters/quickbooks'
import { XeroAdapter } from '@/lib/integrations/adapters/xero'
import type { AccountingAdapter, AccountingProvider } from '@/lib/integrations/types'

const adapters: Record<AccountingProvider, AccountingAdapter> = {
  xero: new XeroAdapter(),
  quickbooks: new QuickBooksAdapter(),
  freshbooks: new FreshBooksAdapter(),
  myob: new MyobAdapter(),
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
