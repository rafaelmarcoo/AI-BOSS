import { z } from 'zod'
import {
  BUSINESS_SIZES,
  GEN_UI_DECISION_ROLES,
  GEN_UI_DETAIL_LEVELS,
  GEN_UI_PRIORITY_TOPICS,
} from '@/lib/gen-ui/preferences-types'

export const GenUiPreferencesUpdateSchema = z.object({
  businessSize: z.enum(BUSINESS_SIZES).nullable(),
  decisionRole: z.enum(GEN_UI_DECISION_ROLES),
  priorityTopics: z.array(z.enum(GEN_UI_PRIORITY_TOPICS)).max(3),
  detailLevel: z.enum(GEN_UI_DETAIL_LEVELS),
  planningHorizon: z.union([z.literal(3), z.literal(6), z.literal(12)]),
  learnFromHistory: z.boolean(),
})

export type GenUiPreferencesUpdateInput = z.infer<
  typeof GenUiPreferencesUpdateSchema
>
