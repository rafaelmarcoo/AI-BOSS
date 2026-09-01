import {
  GEN_UI_WIDGET_CATALOG,
  GEN_UI_WIDGET_SIZES,
  GEN_UI_WIDGET_SIZE_DIMENSIONS,
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
        defaultSize: expect.stringMatching(/^(1x1|1x2|2x2)$/),
      })
    }
  })

  it('builds planner guidance from the catalog', () => {
    const guidance = describeGenUiWidgetCatalog()

    for (const type of GEN_UI_WIDGET_TYPES) {
      expect(guidance).toContain(`${type}:`)
    }
  })

  it('uses the three-size, two-column layout contract', () => {
    expect(GEN_UI_WIDGET_SIZES).toEqual(['1x1', '1x2', '2x2'])
    expect(GEN_UI_WIDGET_SIZE_DIMENSIONS).toEqual({
      '1x1': { rowSpan: 1, columnSpan: 1 },
      '1x2': { rowSpan: 1, columnSpan: 2 },
      '2x2': { rowSpan: 2, columnSpan: 2 },
    })
    expect(GEN_UI_WIDGET_CATALOG.metric_snapshot.defaultSize).toBe('1x1')
    expect(GEN_UI_WIDGET_CATALOG.metric_trend_chart.defaultSize).toBe('2x2')
  })
})
