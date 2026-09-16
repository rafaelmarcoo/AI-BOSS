import { ApiError } from '@/lib/api/errors'
import { createAdminSupabaseClient } from '@/lib/supabase'

export async function findCompanyByName(requestedCompanyName: string) {
  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('companies')
    .select('id, name')

  if (error) {
    throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to check the company name.')
  }

  const normalizedName = requestedCompanyName.trim().toLocaleLowerCase()
  return (
    data?.find(
      (company) =>
        typeof company.name === 'string' &&
        company.name.trim().toLocaleLowerCase() === normalizedName
    ) ?? null
  )
}

export async function findCompanyByJoinCode(joinCode: string) {
  const admin = createAdminSupabaseClient()
  const { data: codeRecord, error: codeError } = await admin
    .from('company_join_codes')
    .select('company_id')
    .eq('join_code', joinCode)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (codeError) {
    throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to validate the company code.')
  }

  if (!codeRecord) return null

  const { data: company, error: companyError } = await admin
    .from('companies')
    .select('id, name')
    .eq('id', codeRecord.company_id)
    .maybeSingle()

  if (companyError) {
    throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to load the company.')
  }

  return company
}

export async function getCompanyJoinCodeForAdmin(userId: string) {
  const company = await getUserCompany(userId)

  if (company.userType !== 'admin') {
    throw new ApiError(403, 'FORBIDDEN', 'Only company admins can view the join code.')
  }

  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('company_join_codes')
    .select('join_code, expires_at')
    .eq('company_id', company.id)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (error || !data) {
    throw new ApiError(500, 'INTERNAL_ERROR', 'The company join code is unavailable.')
  }

  return {
    code: data.join_code as string,
    expiresAt: data.expires_at as string,
  }
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
