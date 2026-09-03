import type {
  BusinessSize,
  GenUiDecisionRole,
  GenUiDetailLevel,
  GenUiPlanningHorizon,
  GenUiPriorityTopic,
} from '@/types/database'

export type {
  BusinessSize,
  GenUiDecisionRole,
  GenUiDetailLevel,
  GenUiPlanningHorizon,
  GenUiPriorityTopic,
} from '@/types/database'

export const BUSINESS_SIZES = ['small', 'medium', 'large'] as const
export const ADMIN_GEN_UI_DECISION_ROLES = ['owner', 'finance', 'manager'] as const
export const WORKER_GEN_UI_DECISION_ROLES = [
  'accountant',
  'operations',
  'team_member',
] as const
export const GEN_UI_DECISION_ROLES = [
  ...ADMIN_GEN_UI_DECISION_ROLES,
  ...WORKER_GEN_UI_DECISION_ROLES,
] as const
export const GEN_UI_PRIORITY_TOPICS = [
  'cash_runway',
  'growth',
  'cost_control',
  'collections',
  'forecasting',
  'profitability',
] as const
export const GEN_UI_DETAIL_LEVELS = ['quick', 'balanced', 'detailed'] as const
export const GEN_UI_PLANNING_HORIZONS = [3, 6, 12] as const

export interface GenUiPersonalization {
  businessSize: BusinessSize | null
  canEditBusinessSize: boolean
  decisionRole: GenUiDecisionRole
  priorityTopics: GenUiPriorityTopic[]
  detailLevel: GenUiDetailLevel
  planningHorizon: GenUiPlanningHorizon
  learnFromHistory: boolean
}

export const DEFAULT_GEN_UI_USER_PREFERENCES = {
  decisionRole: 'owner',
  priorityTopics: [],
  detailLevel: 'balanced',
  planningHorizon: 6,
  learnFromHistory: false,
} as const satisfies Omit<
  GenUiPersonalization,
  'businessSize' | 'canEditBusinessSize'
>

export const DEFAULT_GEN_UI_PERSONALIZATION: GenUiPersonalization = {
  businessSize: null,
  canEditBusinessSize: false,
  ...DEFAULT_GEN_UI_USER_PREFERENCES,
}

export const BUSINESS_SIZE_LABELS: Record<BusinessSize, string> = {
  small: 'Small business',
  medium: 'Medium business',
  large: 'Large business',
}

export const DECISION_ROLE_LABELS: Record<GenUiDecisionRole, string> = {
  owner: 'Owner or founder',
  finance: 'Finance administrator',
  manager: 'Senior manager',
  accountant: 'Finance team member',
  operations: 'Operations or team lead',
  team_member: 'General team member',
}

export const PRIORITY_TOPIC_LABELS: Record<GenUiPriorityTopic, string> = {
  cash_runway: 'Cash & runway',
  growth: 'Revenue growth',
  cost_control: 'Costs & efficiency',
  collections: 'Invoices & collections',
  forecasting: 'Forecasting',
  profitability: 'Profitability',
}

export const DETAIL_LEVEL_LABELS: Record<GenUiDetailLevel, string> = {
  quick: 'Quick overview',
  balanced: 'Balanced',
  detailed: 'Detailed',
}

export function recommendedWidgetLimit(detailLevel: GenUiDetailLevel) {
  if (detailLevel === 'quick') return 2
  if (detailLevel === 'detailed') return 5
  return 3
}
