import { CIMA_CASE_STUDIES } from '@/lib/company-analysis/cima-case-studies'
import { statementsFromCaseStudy } from '@/lib/company-analysis/statement-analysis'
import { buildStatementTemplate } from '@/lib/company-analysis/statement-template'

export function buildExampleTemplate() {
  const ressett = CIMA_CASE_STUDIES.find((company) => company.name === 'Ressett')
  if (!ressett) throw new Error('The Ressett case study is missing.')
  return buildStatementTemplate(statementsFromCaseStudy(ressett).years)
}
