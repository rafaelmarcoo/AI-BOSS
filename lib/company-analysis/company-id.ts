import { ApiError } from '@/lib/api/errors'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function assertCompanyId(companyId: string, message = 'Couldn\'t find that company.') {
  if (!UUID_PATTERN.test(companyId)) {
    throw new ApiError(404, 'NOT_FOUND', message)
  }
  return companyId
}
