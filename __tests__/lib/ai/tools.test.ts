import { z } from 'zod'
import { stripUnsupportedKeywords } from '@/lib/ai/tools'

function googleSchema(schema: z.ZodType) {
  return JSON.parse(
    JSON.stringify(stripUnsupportedKeywords(z.toJSONSchema(schema)))
  )
}

describe('stripUnsupportedKeywords (Google dialect)', () => {
  const adjustment = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('fixed'), amount: z.number() }),
    z.object({ kind: z.literal('percentage'), percent: z.number() }),
  ])

  it('turns a string const into a one-value enum so union branches stay distinct', () => {
    const [fixed, percentage] = googleSchema(adjustment).anyOf ?? googleSchema(adjustment).oneOf

    expect(fixed.properties.kind).toEqual({ type: 'string', enum: ['fixed'] })
    expect(percentage.properties.kind).toEqual({ type: 'string', enum: ['percentage'] })
  })

  it('keeps a numeric const as a description, since Gemini enums must be strings', () => {
    const horizon = z.union([z.literal(3), z.literal(6)])
    const [three, six] = googleSchema(horizon).anyOf

    expect(three).toEqual({ type: 'number', description: 'Must be exactly 3.' })
    expect(six).toEqual({ type: 'number', description: 'Must be exactly 6.' })
  })

  it('appends to an existing description instead of replacing it', () => {
    const schema = z.object({ size: z.literal(12).describe('Months to project.') })

    expect(googleSchema(schema).properties.size.description).toBe(
      'Months to project. Must be exactly 12.'
    )
  })

  it('leaves no keyword Google rejects anywhere in the schema', () => {
    const schema = z.object({
      adjustments: z.array(adjustment),
      horizon: z.union([z.literal(3), z.literal(6)]).default(6),
      amount: z.number().positive(),
    })
    const serialised = JSON.stringify(googleSchema(schema))

    for (const keyword of ['"const"', '"default"', '"$schema"', '"additionalProperties"', '"exclusiveMinimum"']) {
      expect(serialised).not.toContain(keyword)
    }
  })
})
