import { z } from 'zod'
import { FINANCIAL_METRIC_KEYS } from '@/lib/financial-data/metric-keys'
import { GEN_UI_WIDGET_SIZES } from '@/lib/gen-ui/catalog'
import {
  DASHBOARD_FORECAST_HORIZONS,
  DASHBOARD_LAYOUT_VERSION,
  MAX_DASHBOARD_LAYOUT_WIDGETS,
} from '@/lib/gen-ui/dashboard-layout-types'
import { GEN_UI_SUPPORTED_PERIODS } from '@/lib/gen-ui/requirements'
import { GEN_UI_WIDGET_TYPES } from '@/lib/gen-ui/types'

const PercentageSchema = z.number().min(0).max(100)

export const DashboardRiskThresholdsSchema = z
  .object({
    runwayCautionMonths: z.number().positive().max(60),
    runwayUrgentMonths: z.number().positive().max(60),
    customerTopOneElevatedPercent: PercentageSchema,
    customerTopOneHighPercent: PercentageSchema,
    customerTopThreeElevatedPercent: PercentageSchema,
    customerTopThreeHighPercent: PercentageSchema,
  })
  .superRefine((value, context) => {
    if (value.runwayUrgentMonths >= value.runwayCautionMonths) {
      context.addIssue({
        code: 'custom',
        path: ['runwayUrgentMonths'],
        message: 'Urgent runway must be below the caution threshold.',
      })
    }
    if (value.customerTopOneElevatedPercent >= value.customerTopOneHighPercent) {
      context.addIssue({
        code: 'custom',
        path: ['customerTopOneElevatedPercent'],
        message: 'The elevated top-customer threshold must be below high risk.',
      })
    }
    if (
      value.customerTopThreeElevatedPercent >=
      value.customerTopThreeHighPercent
    ) {
      context.addIssue({
        code: 'custom',
        path: ['customerTopThreeElevatedPercent'],
        message: 'The elevated top-three threshold must be below high risk.',
      })
    }
  })

export const DashboardLayoutWidgetSchema = z.object({
  id: z.string().uuid(),
  widgetType: z.enum(GEN_UI_WIDGET_TYPES),
  title: z.string().trim().min(1).max(80).nullable(),
  reason: z.string().trim().min(1).max(240).nullable(),
  size: z.enum(GEN_UI_WIDGET_SIZES),
  isPinned: z.boolean(),
  isHidden: z.boolean(),
  period: z.enum(GEN_UI_SUPPORTED_PERIODS).nullable(),
  forecastHorizon: z
    .union(DASHBOARD_FORECAST_HORIZONS.map((value) => z.literal(value)))
    .nullable(),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/, 'Currency must be a three-letter ISO code.')
    .nullable(),
  metricKeys: z.array(z.enum(FINANCIAL_METRIC_KEYS)).max(4),
})

export const DashboardLayoutPayloadSchema = z.object({
  version: z.literal(DASHBOARD_LAYOUT_VERSION),
  widgets: z
    .array(DashboardLayoutWidgetSchema)
    .max(MAX_DASHBOARD_LAYOUT_WIDGETS)
    .superRefine((widgets, context) => {
      const ids = new Set<string>()
      widgets.forEach((widget, index) => {
        if (ids.has(widget.id)) {
          context.addIssue({
            code: 'custom',
            path: [index, 'id'],
            message: 'Widget IDs must be unique within a layout.',
          })
        }
        ids.add(widget.id)
      })
    }),
  riskThresholds: DashboardRiskThresholdsSchema,
})

const LayoutNameSchema = z.string().trim().min(1).max(80)

export const DashboardLayoutCreateSchema = z.object({
  name: LayoutNameSchema,
  isDefault: z.boolean().default(false),
  sourcePlanVersion: z.number().int().positive().nullable().default(null),
  sourceGeneratedAt: z.string().datetime().nullable().default(null),
  payload: DashboardLayoutPayloadSchema,
})

export const DashboardLayoutUpdateSchema = z
  .object({
    name: LayoutNameSchema.optional(),
    isDefault: z.boolean().optional(),
    sourcePlanVersion: z.number().int().positive().nullable().optional(),
    sourceGeneratedAt: z.string().datetime().nullable().optional(),
    payload: DashboardLayoutPayloadSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one layout change.',
  })

export const DashboardLayoutHydrateSchema = z.object({
  payload: DashboardLayoutPayloadSchema,
})

export type DashboardLayoutCreateInput = z.infer<
  typeof DashboardLayoutCreateSchema
>
export type DashboardLayoutUpdateInput = z.infer<
  typeof DashboardLayoutUpdateSchema
>

