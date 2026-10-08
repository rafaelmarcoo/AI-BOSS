import {
  assertModelAvailable,
  listModelCapabilities,
  MODEL_NAMES,
  parseStoredModel,
} from '@/lib/ai/models'

describe('model capabilities', () => {
  const originalOpenAiKey = process.env.OPENAI_API_KEY
  const originalGeminiKey = process.env.GEMINI_API_KEY

  afterEach(() => {
    if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = originalOpenAiKey
    if (originalGeminiKey === undefined) delete process.env.GEMINI_API_KEY
    else process.env.GEMINI_API_KEY = originalGeminiKey
  })

  it('returns safe catalogue metadata and availability without secret details', () => {
    process.env.OPENAI_API_KEY = 'test-key'
    delete process.env.GEMINI_API_KEY

    const capabilities = listModelCapabilities()

    expect(capabilities).toHaveLength(MODEL_NAMES.length)
    expect(capabilities.find((model) => model.id === 'gpt-4o')).toMatchObject({
      provider: 'OpenAI',
      available: true,
    })
    expect(capabilities.find((model) => model.id === 'gemini-flash')).toMatchObject({
      provider: 'Google Gemini',
      available: false,
    })
    expect(JSON.stringify(capabilities)).not.toContain('API_KEY')
  })

  it('rejects an unavailable model before an external call', () => {
    delete process.env.GEMINI_API_KEY

    expect(() => assertModelAvailable('gemini-flash')).toThrow(
      'unavailable because its provider is not configured'
    )
  })

  it('falls back safely when a stored legacy value is not in the catalogue', () => {
    expect(parseStoredModel('retired-model')).toBeUndefined()
    expect(parseStoredModel('gpt-4o')).toBe('gpt-4o')
  })
})
