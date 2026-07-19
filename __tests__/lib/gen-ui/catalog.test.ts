import {
  GEN_UI_WIDGET_CATALOG,
  describeGenUiWidgetCatalog,
} from '@/lib/gen-ui/catalog'
import { GEN_UI_WIDGET_TYPES } from '@/lib/gen-ui/types'

describe('Gen UI widget catalog', () => {
  it('defines metadata for every allowed widget type', () => {
    expect(Object.keys(GEN_UI_WIDGET_CATALOG)).toEqual(GEN_UI_WIDGET_TYPES)

    for (const type of GEN_UI_WIDGET_TYPES) {
      expect(GEN_UI_WIDGET_CATALOG[type]).toMatchObject({
        type,
        label: expect.any(String),
        description: expect.any(String),
        selectionGuidance: expect.any(String),
      })
    }
  })

  it('builds planner guidance from the catalog', () => {
    const guidance = describeGenUiWidgetCatalog()

    for (const type of GEN_UI_WIDGET_TYPES) {
      expect(guidance).toContain(`${type}:`)
    }
  })
})
