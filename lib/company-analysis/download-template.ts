export type TemplateKind = 'blank' | 'example'

const FILE_NAMES: Record<TemplateKind, string> = {
  blank: 'company-statements-template.csv',
  example: 'company-statements-example-ressett.csv',
}
export async function downloadStatementTemplate(kind: TemplateKind) {
  const text =
    kind === 'blank'
      ? (await import('@/lib/company-analysis/statement-template')).buildBlankTemplate()
      : (await import('@/lib/company-analysis/example-template')).buildExampleTemplate()

  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = FILE_NAMES[kind]
  link.click()
  URL.revokeObjectURL(url)
}
