import {
  MODEL_CATALOG,
  MODEL_NAMES,
  createChatModel,
  resolveModel,
  type ModelName,
} from '../lib/ai/models'

const DIVIDER = '─'.repeat(72)

async function checkModel(name: ModelName) {
  const { provider, apiKey } = resolveModel(name)

  if (!apiKey) {
    return {
      name,
      status: 'skipped' as const,
      detail: `no ${provider.apiKeyEnv}`,
      ms: 0,
    }
  }

  const startedAt = Date.now()

  try {
    const model = createChatModel(name, { temperature: 0 })
    const response = await model.invoke('Reply with the single word: ok')
    const content =
      typeof response.content === 'string'
        ? response.content.trim()
        : JSON.stringify(response.content)

    return {
      name,
      status: 'ok' as const,
      detail: content.slice(0, 40),
      ms: Date.now() - startedAt,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    return {
      name,
      status: 'failed' as const,
      detail: message.slice(0, 120),
      ms: Date.now() - startedAt,
    }
  }
}

async function main() {
  console.log(`\nChecking ${MODEL_NAMES.length} models in the catalogue`)
  console.log(DIVIDER)

  const results = []

  for (const name of MODEL_NAMES) {
    const result = await checkModel(name)
    results.push(result)

    const spec = MODEL_CATALOG[name]
    const icon =
      result.status === 'ok' ? 'PASS' : result.status === 'skipped' ? 'SKIP' : 'FAIL'
    const timing = result.ms > 0 ? ` ${result.ms}ms` : ''

    console.log(
      `${icon}  ${spec.label.padEnd(20)} ${String(spec.model).padEnd(26)}${timing}`
    )

    if (result.status !== 'ok') {
      console.log(`      ${result.detail}`)
    }
  }

  console.log(DIVIDER)

  const contradictions = results.filter((result) => {
    const claimed = MODEL_CATALOG[result.name].verified
    if (result.status === 'ok' && !claimed) return true
    if (result.status === 'failed' && claimed) return true
    return false
  })

  if (contradictions.length > 0) {
    console.log('\nCatalogue `verified` flags that disagree with this run:')

    for (const result of contradictions) {
      const spec = MODEL_CATALOG[result.name]
      const shouldBe = result.status === 'ok'
      console.log(
        `  ${result.name}: verified is ${spec.verified}, should be ${shouldBe}`
      )
    }

    console.log('  Update lib/ai/models.ts so the catalogue reflects reality.')
  }


  const ok = results.filter((r) => r.status === 'ok')
  const failed = results.filter((r) => r.status === 'failed')
  const skipped = results.filter((r) => r.status === 'skipped')

  console.log(
    `${ok.length} working, ${failed.length} failed, ${skipped.length} skipped (no key)`
  )

  if (skipped.length > 0) {
    console.log('\nTo enable the skipped models, add these to .env.local:')
    const seen = new Set<string>()

    for (const result of skipped) {
      const { provider } = resolveModel(result.name)
      if (seen.has(provider.apiKeyEnv)) continue
      seen.add(provider.apiKeyEnv)
      console.log(`  ${provider.apiKeyEnv}=...   # ${provider.docsUrl}`)
    }
  }

  if (failed.length > 0) {
    console.log(
      '\nFailures usually mean a wrong model id or an unsupported endpoint.'
    )
    console.log('Check the provider docs listed above for current model names.')
  }

  console.log(
    '\nOnce a model passes, set verified: true for it in lib/ai/models.ts\n'
  )
}

main().catch((error) => {
  console.error('\nModel check failed:', error)
  process.exit(1)
})
