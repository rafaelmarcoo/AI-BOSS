import type { AnalysedCompany } from '@/types/database'

export function normalizeCompanyName(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]s\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export type CompanyLookup =
  | { status: 'found'; company: AnalysedCompany }
  | { status: 'ambiguous'; matches: AnalysedCompany[] }
  | { status: 'not_found' }

export function findCompany(companies: AnalysedCompany[], query: string): CompanyLookup {
  const wanted = normalizeCompanyName(query)
  if (!wanted) return { status: 'not_found' }

  const exact = companies.filter((company) => normalizeCompanyName(company.name) === wanted)
  if (exact.length === 1) return { status: 'found', company: exact[0] }

  // A partial name ("pallo"), or a name inside a longer phrase ("ressett group").
  const partial = companies.filter((company) => {
    const name = normalizeCompanyName(company.name)
    return name.includes(wanted) || wanted.includes(name)
  })

  if (partial.length === 1) return { status: 'found', company: partial[0] }
  if (partial.length > 1) return { status: 'ambiguous', matches: partial }
  return { status: 'not_found' }
}

/** Other companies in the same peer group: the company's competitors. */
export function findPeers(companies: AnalysedCompany[], company: AnalysedCompany) {
  if (!company.peer_group) return []
  return companies.filter(
    (other) => other.id !== company.id && other.peer_group === company.peer_group
  )
}
