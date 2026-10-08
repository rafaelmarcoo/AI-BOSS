import { uniqueWidgets } from '@/lib/gen-ui/unique-widgets'
import { GEN_UI_WIDGET_TYPES } from '@/lib/gen-ui/types'

it('keeps one instance of every type without mutating the plan or blocking later turns', () => {
  const widgets = GEN_UI_WIDGET_TYPES.map((type) => ({ type, id: type }))
  expect(uniqueWidgets([...widgets, ...widgets.map((widget) => ({
    ...widget, id: widget.id + '-duplicate',
  }))])).toEqual(widgets)
  expect(uniqueWidgets(widgets)).toEqual(widgets)
  expect(uniqueWidgets([])).toEqual([])
})

it('keeps same-type widgets when they show different metrics', () => {
  const cash = {
    type: 'metric_snapshot' as const,
    id: 'cash',
    data: { metrics: [{ key: 'cash' }] },
  }
  const burn = {
    type: 'metric_snapshot' as const,
    id: 'burn',
    data: { metrics: [{ key: 'burn_rate' }] },
  }

  expect(uniqueWidgets([cash, burn, { ...cash, id: 'cash-duplicate' }]))
    .toEqual([cash, burn])
})
