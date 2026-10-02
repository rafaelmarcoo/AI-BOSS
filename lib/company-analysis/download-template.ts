export type TemplateKind = 'blank' | 'example'

const FILE_NAMES: Record<TemplateKind, string> = {
  blank: 'company-statements-template.csv',
  example: 'company-statements-example-ressett.csv',
}

function saveFile(fileName: string, contents: Blob) {
  const url = URL.createObjectURL(contents)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

export async function downloadStatementTemplate(kind: TemplateKind) {
  const text =
    kind === 'blank'
      ? (await import('@/lib/company-analysis/statement-template')).buildBlankTemplate()
      : (await import('@/lib/company-analysis/example-template')).buildExampleTemplate()

  saveFile(FILE_NAMES[kind], new Blob([text], { type: 'text/csv;charset=utf-8' }))
}

export async function downloadCompanyFigures(companyId: string) {
  const response = await fetch(`/api/companies/${encodeURIComponent(companyId)}/template`)
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
    throw new Error(payload?.error?.message ?? 'Could not download the figures.')
  }

  const fileName =
    response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ?? 'company-statements.csv'
  saveFile(fileName, await response.blob())
}
