import { fireEvent, render, screen } from '@testing-library/react'
import { DashboardWidgetGrid } from '@/app/dashboard/runway/gen-ui/layout/DashboardWidgetGrid'
import {
  DASHBOARD_LAYOUT_VERSION,
  DEFAULT_DASHBOARD_RISK_THRESHOLDS,
  type DashboardLayoutPayload,
  type HydratedDashboardLayout,
} from '@/lib/gen-ui/dashboard-layout-types'

const firstId = '11111111-1111-4111-8111-111111111111'
const secondId = '22222222-2222-4222-8222-222222222222'

const payload: DashboardLayoutPayload = {
  version: DASHBOARD_LAYOUT_VERSION,
  widgets: [
    {
      id: firstId,
      widgetType: 'cash_balance',
      title: 'Cash one',
      reason: 'First widget.',
      size: '1x1',
      isPinned: false,
      isHidden: false,
      period: 'current',
      forecastHorizon: null,
      currency: 'NZD',
      metricKeys: [],
    },
    {
      id: secondId,
      widgetType: 'cash_balance',
      title: 'Cash two',
      reason: 'Second widget.',
      size: '1x1',
      isPinned: false,
      isHidden: false,
      period: 'current',
      forecastHorizon: null,
      currency: 'NZD',
      metricKeys: [],
    },
  ],
  riskThresholds: { ...DEFAULT_DASHBOARD_RISK_THRESHOLDS },
}

function cashWidget(id: string, title: string) {
  return {
    id,
    type: 'cash_balance' as const,
    title,
    reason: 'Trusted current cash.',
    data: {
      metricKey: 'cash' as const,
      label: 'Cash',
      value: 100,
      currency: 'NZD',
      reportingDate: '2026-09-30',
      periodStart: null,
      periodEnd: null,
      sourceLabel: 'Xero',
      sourceType: 'xero',
      confidence: 1,
    },
  }
}

const hydration: HydratedDashboardLayout = {
  items: [
    { itemId: firstId, widget: cashWidget(firstId, 'Cash one'), error: null },
    { itemId: secondId, widget: cashWidget(secondId, 'Cash two'), error: null },
  ],
  availableCurrencies: ['AUD', 'NZD'],
}

describe('DashboardWidgetGrid customization', () => {
  it('hides widgets and reorders them through drag and drop', () => {
    const onPayloadChange = jest.fn()
    const { container } = render(
      <DashboardWidgetGrid
        payload={payload}
        hydration={hydration}
        editing
        onPayloadChange={onPayloadChange}
        onAskChatbot={jest.fn()}
      />,
    )

    fireEvent.click(screen.getAllByRole('button', { name: 'Hide widget' })[0])
    expect(onPayloadChange).toHaveBeenCalledWith(expect.objectContaining({
      widgets: expect.arrayContaining([
        expect.objectContaining({ id: firstId, isHidden: true }),
      ]),
    }))

    const cards = container.querySelectorAll('[draggable="true"]')
    const values: Record<string, string> = {}
    const dataTransfer = {
      setData: (type: string, value: string) => { values[type] = value },
      getData: (type: string) => values[type] ?? '',
    }
    fireEvent.dragStart(cards[0], { dataTransfer })
    fireEvent.dragOver(cards[1], { dataTransfer })
    fireEvent.drop(cards[1], { dataTransfer })

    expect(onPayloadChange).toHaveBeenLastCalledWith(expect.objectContaining({
      widgets: [
        expect.objectContaining({ id: secondId }),
        expect.objectContaining({ id: firstId }),
      ],
    }))
  })
})

