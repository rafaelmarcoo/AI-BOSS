import type { AccountingAdapter, AccountingProvider } from './types'
import { XeroAdapter } from './adapters/xero'
import { QuickBooksAdapter } from './adapters/quickbooks'
import { FreshBooksAdapter } from './adapters/freshbooks'
import { MyobAdapter } from './adapters/myob'
import { ApiError } from '@/lib/api/errors'

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
