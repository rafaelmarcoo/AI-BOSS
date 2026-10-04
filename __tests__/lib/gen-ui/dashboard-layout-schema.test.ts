import { GEN_UI_PLAN_VERSION } from '@/lib/gen-ui/types'
import { dashboardPayloadFromPlan } from '@/lib/gen-ui/dashboard-layout-client'
import { DashboardLayoutPayloadSchema } from '@/lib/gen-ui/dashboard-layout-schema'
import {
  DASHBOARD_LAYOUT_VERSION,
  DEFAULT_DASHBOARD_RISK_THRESHOLDS,
} from '@/lib/gen-ui/dashboard-layout-types'

const widgetId = '11111111-1111-4111-8111-111111111111'

function validPayload() {
  return {
    version: DASHBOARD_LAYOUT_VERSION,
    widgets: [{
      id: widgetId,
      widgetType: 'cash_balance' as const,
      title: 'Cash balance',
      reason: 'Tracks available cash.',
      size: '1x1' as const,
      isPinned: false,
      isHidden: false,
      period: 'current' as const,
      forecastHorizon: null,
      currency: 'NZD',
      metricKeys: [],
    }],
    riskThresholds: { ...DEFAULT_DASHBOARD_RISK_THRESHOLDS },
  }
}

describe('dashboard layout contracts', () => {
  it('validates a versioned layout without storing financial widget data', () => {
    expect(DashboardLayoutPayloadSchema.safeParse(validPayload()).success).toBe(true)
  })

  it('rejects duplicate widget identities and inverted risk thresholds', () => {
    const payload = validPayload()
    payload.widgets.push({ ...payload.widgets[0] })
    payload.riskThresholds.runwayUrgentMonths = 8

    expect(DashboardLayoutPayloadSchema.safeParse(payload).success).toBe(false)
  })

  it('copies layout intent from an AI plan without copying trusted values', () => {
    const payload = dashboardPayloadFromPlan({
      version: GEN_UI_PLAN_VERSION,
      source: 'chat',
      generatedAt: '2026-09-30T00:00:00.000Z',
      summary: 'Current cash.',
      widgets: [{
        id: 'cash-1',
        type: 'cash_balance',
        title: 'Cash balance',
        reason: 'Current liquidity.',
        data: {
          metricKey: 'cash',
          label: 'Cash',
          value: 123456,
          currency: 'NZD',
          reportingDate: '2026-09-30',
          periodStart: null,
          periodEnd: null,
          sourceLabel: 'Xero',
          sourceType: 'xero',
          confidence: 1,
        },
      }],
    })

    expect(payload.widgets[0]).toMatchObject({
      widgetType: 'cash_balance',
      currency: 'NZD',
    })
    expect(JSON.stringify(payload)).not.toContain('123456')
    expect(JSON.stringify(payload)).not.toContain('sourceLabel')
  })
})

