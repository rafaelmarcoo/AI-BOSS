import { ApiError } from '@/lib/api/errors'
import { createAdminSupabaseClient } from '@/lib/supabase'

export async function getJoinableCompanyNames() {
  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('users')
    .select('company_name')
    .eq('user_type', 'admin')
    .not('company_name', 'is', null)
    .order('company_name')

  if (error) {
    throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to load companies.')
  }

  const companies = new Map<string, string>()

  for (const row of data ?? []) {
    if (typeof row.company_name !== 'string') continue

    const companyName = row.company_name.trim()
    const normalizedName = companyName.toLocaleLowerCase()

    if (companyName && !companies.has(normalizedName)) {
      companies.set(normalizedName, companyName)
    }
  }

  return [...companies.values()].sort((left, right) => left.localeCompare(right))
}

export function findCompanyName(companies: string[], requestedCompanyName: string) {
  const normalizedName = requestedCompanyName.toLocaleLowerCase()
  return companies.find(
    (companyName) => companyName.toLocaleLowerCase() === normalizedName
  )
}
