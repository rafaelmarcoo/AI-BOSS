import { MODEL_PROVIDERS, type ProviderId } from '../lib/ai/models'

const TIMEOUT_MS = 15_000

async function listModels(id: ProviderId) {
  const provider = MODEL_PROVIDERS[id]
  const apiKey = process.env[provider.apiKeyEnv]

  console.log(`\n── ${provider.label} (${provider.apiKeyEnv})`)

  if (!apiKey) {
    console.log('   no key set, skipping')
    return
  }

  const baseUrl = 'baseUrl' in provider ? provider.baseUrl : 'https://api.openai.com/v1'
  const url = `${String(baseUrl).replace(/\/$/, '')}/models`

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!response.ok) {
      console.log(`   ${response.status} ${response.statusText} from ${url}`)
      const body = await response.text()
      if (body) console.log(`   ${body.slice(0, 200)}`)
      return
    }

    const payload = (await response.json()) as { data?: { id?: string }[] }
    const ids = (payload.data ?? []).map((entry) => entry.id).filter(Boolean)

    if (ids.length === 0) {
      console.log('   responded, but listed no models')
      return
    }

    console.log(`   ${ids.length} models:`)
    for (const modelId of ids.sort()) {
      console.log(`     ${modelId}`)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.log(`   could not reach ${url}`)
    console.log(`   ${message}`)
  }
}

async function main() {
  const ids = Object.keys(MODEL_PROVIDERS) as ProviderId[]

  for (const id of ids) {
    await listModels(id)
  }

  console.log('\nUse these exact ids in MODEL_CATALOG in lib/ai/models.ts\n')
}

main().catch((error) => {
  console.error('\nFailed:', error)
  process.exit(1)
})
