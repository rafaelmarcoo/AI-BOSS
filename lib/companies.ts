import { ApiError } from '@/lib/api/errors'
import { createAdminSupabaseClient } from '@/lib/supabase'

export async function getJoinableCompanyNames() {
  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('companies')
    .select('name')
    .order('name')

  if (error) {
    throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to load companies.')
  }

  const companies = new Map<string, string>()

  for (const row of data ?? []) {
    if (typeof row.name !== 'string') continue

    const companyName = row.name.trim()
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

export async function getUserCompany(userId: string) {
  const admin = createAdminSupabaseClient()
  const { data: profile, error: profileError } = await admin
    .from('users')
    .select('company_name, user_type')
    .eq('id', userId)
    .single()

  if (profileError || !profile?.company_name) {
    throw new ApiError(403, 'FORBIDDEN', 'Your account is not linked to a company.')
  }

  const { data: companies, error: companyError } = await admin
    .from('companies')
    .select('id, name')
  const normalizedCompanyName = profile.company_name.trim().toLocaleLowerCase()
  const company = companies?.find(
    (candidate) => candidate.name.trim().toLocaleLowerCase() === normalizedCompanyName
  )

  if (companyError || !company) {
    throw new ApiError(403, 'FORBIDDEN', 'Your company could not be found.')
  }

  return {
    id: company.id as string,
    name: company.name as string,
    userType: profile.user_type as 'admin' | 'employee' | null,
  }
}
