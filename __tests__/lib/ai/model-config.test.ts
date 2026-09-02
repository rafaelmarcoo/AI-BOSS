describe('AI model configuration', () => {
  const originalChatModel = process.env.OPENAI_CHAT_MODEL
  const originalUtilityModel = process.env.OPENAI_UTILITY_MODEL

  afterEach(() => {
    jest.resetModules()

    if (originalChatModel === undefined) {
      delete process.env.OPENAI_CHAT_MODEL
    } else {
      process.env.OPENAI_CHAT_MODEL = originalChatModel
    }

    if (originalUtilityModel === undefined) {
      delete process.env.OPENAI_UTILITY_MODEL
    } else {
      process.env.OPENAI_UTILITY_MODEL = originalUtilityModel
    }
  })

  it('uses the cost-conscious defaults when overrides are absent', async () => {
    delete process.env.OPENAI_CHAT_MODEL
    delete process.env.OPENAI_UTILITY_MODEL

    const config = await import('@/lib/ai/model-config')

    expect(config.CHAT_MODEL).toBe('gpt-5.6-luna')
    expect(config.UTILITY_MODEL).toBe('gpt-4o-mini-2024-07-18')
    expect(config.mainModelOptions()).toEqual({
      useResponsesApi: true,
      reasoning: { effort: 'low' },
    })
  })

  it('honours trimmed server-side model overrides', async () => {
    process.env.OPENAI_CHAT_MODEL = '  gpt-4o-mini  '
    process.env.OPENAI_UTILITY_MODEL = '  test-utility-model  '

    const config = await import('@/lib/ai/model-config')

    expect(config.CHAT_MODEL).toBe('gpt-4o-mini')
    expect(config.UTILITY_MODEL).toBe('test-utility-model')
    expect(config.mainModelOptions()).toEqual({
      useResponsesApi: true,
      temperature: 0,
    })
  })
})
