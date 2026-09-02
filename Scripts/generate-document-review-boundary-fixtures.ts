import fs from 'node:fs'
import path from 'node:path'

const fixtureDirectory = path.join(
  process.cwd(),
  'demo-assets',
  'document-review-fixtures'
)
const outputDirectory = path.join(fixtureDirectory, 'generated-local')
const sourcePdf = path.join(
  fixtureDirectory,
  '11-text-financial-statement.pdf'
)
const oversizedPdf = path.join(outputDirectory, '14-too-large.pdf')
const rowLimitCsv = path.join(
  outputDirectory,
  '17-too-many-selected-rows.csv'
)
const oversizedBytes = 15 * 1024 * 1024 + 1

async function generateOversizedPdf() {
  const source = await fs.promises.readFile(sourcePdf)
  const file = await fs.promises.open(oversizedPdf, 'w')

  try {
    await file.write(source)
    await file.truncate(oversizedBytes)
  } finally {
    await file.close()
  }
}

async function generateRowLimitCsv() {
  const stream = fs.createWriteStream(rowLimitCsv, { encoding: 'utf8' })
  stream.write('Metric,Amount,Currency,Date\n')

  for (let index = 0; index < 50_001; index += 1) {
    stream.write(`Cash at bank,${100_000 + index},NZD,2026-05-31\n`)
  }

  await new Promise<void>((resolve, reject) => {
    stream.on('error', reject)
    stream.end(resolve)
  })
}

async function main() {
  await fs.promises.mkdir(outputDirectory, { recursive: true })
  await Promise.all([generateOversizedPdf(), generateRowLimitCsv()])

  console.log(`Created ${path.relative(process.cwd(), oversizedPdf)}`)
  console.log(`Created ${path.relative(process.cwd(), rowLimitCsv)}`)
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
