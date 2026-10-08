import { CIMA_CASE_STUDIES } from '@/lib/company-analysis/cima-case-studies'
import { saveSharedCaseStudy } from '@/lib/company-analysis/persistence'

async function main() {
  for (const company of CIMA_CASE_STUDIES) {
    const { lineCount } = await saveSharedCaseStudy(company)
    console.log(`${company.name}: ${lineCount} statement lines saved`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
