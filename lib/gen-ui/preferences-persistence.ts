import 'server-only'

import { ApiError } from '@/lib/api/errors'
import { getUserCompany } from '@/lib/companies'
import {
  ADMIN_GEN_UI_DECISION_ROLES,
  DEFAULT_GEN_UI_USER_PREFERENCES,
  WORKER_GEN_UI_DECISION_ROLES,
  type BusinessSize,
  type GenUiDecisionRole,
  type GenUiDetailLevel,
  type GenUiPersonalization,
  type GenUiPlanningHorizon,
  type GenUiPriorityTopic,
} from '@/lib/gen-ui/preferences-types'
import type { GenUiPreferencesUpdateInput } from '@/lib/gen-ui/preferences-schema'
import { createAdminSupabaseClient } from '@/lib/supabase'
import type { UserGenUiPreferences } from '@/types/database'

function toPersonalization(
  businessSize: BusinessSize | null,
  planningHorizon: GenUiPlanningHorizon,
  canEditBusinessSize: boolean,
  row: UserGenUiPreferences | null
): GenUiPersonalization {
  const availableRoles = canEditBusinessSize
    ? ADMIN_GEN_UI_DECISION_ROLES
    : WORKER_GEN_UI_DECISION_ROLES
  const savedRole = row?.decision_role as GenUiDecisionRole | undefined
  const decisionRole =
    savedRole && availableRoles.some((role) => role === savedRole)
      ? savedRole
      : canEditBusinessSize
        ? DEFAULT_GEN_UI_USER_PREFERENCES.decisionRole
        : 'team_member'

  return {
    businessSize,
    canEditBusinessSize,
    decisionRole,
    priorityTopics:
      (row?.priority_topics as GenUiPriorityTopic[] | undefined) ?? [],
    detailLevel:
      (row?.detail_level as GenUiDetailLevel | undefined) ??
      DEFAULT_GEN_UI_USER_PREFERENCES.detailLevel,
    planningHorizon,
    learnFromHistory:
      row?.learn_from_history ??
      DEFAULT_GEN_UI_USER_PREFERENCES.learnFromHistory,
  }
}

export async function getGenUiPersonalization(
  userId: string
): Promise<GenUiPersonalization> {
  const company = await getUserCompany(userId)
  const admin = createAdminSupabaseClient()
  const [companyResult, preferencesResult] = await Promise.all([
    admin
      .from('companies')
      .select('business_size, planning_horizon')
      .eq('id', company.id)
      .single(),
    admin
      .from('user_gen_ui_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  if (companyResult.error) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Could not load your company preferences.'
    )
  }
  if (preferencesResult.error) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Could not load your AI-BOSS preferences.'
    )
  }

  return toPersonalization(
    (companyResult.data.business_size as BusinessSize | null) ?? null,
    (companyResult.data.planning_horizon as GenUiPlanningHorizon | null) ??
      DEFAULT_GEN_UI_USER_PREFERENCES.planningHorizon,
    company.userType === 'admin',
    (preferencesResult.data as UserGenUiPreferences | null) ?? null
  )
}

export async function updateGenUiPersonalization(
  userId: string,
  input: GenUiPreferencesUpdateInput
): Promise<GenUiPersonalization> {
  const company = await getUserCompany(userId)
  const admin = createAdminSupabaseClient()

  const { data: currentCompany, error: companyReadError } = await admin
    .from('companies')
    .select('business_size, planning_horizon')
    .eq('id', company.id)
    .single()

  if (companyReadError) {
    throw new ApiError(500, 'INTERNAL_ERROR', 'Could not load company settings.')
  }

  const currentBusinessSize =
    (currentCompany.business_size as BusinessSize | null) ?? null
  const currentPlanningHorizon =
    (currentCompany.planning_horizon as GenUiPlanningHorizon | null) ??
    DEFAULT_GEN_UI_USER_PREFERENCES.planningHorizon
  if (
    company.userType !== 'admin' &&
    (input.businessSize !== currentBusinessSize ||
      input.planningHorizon !== currentPlanningHorizon)
  ) {
    throw new ApiError(
      403,
      'FORBIDDEN',
      'Only a company admin can change company planning settings.'
    )
  }

  const validRoles =
    company.userType === 'admin'
      ? ADMIN_GEN_UI_DECISION_ROLES
      : WORKER_GEN_UI_DECISION_ROLES
  if (!validRoles.some((role) => role === input.decisionRole)) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'Choose a decision role available for your account type.'
    )
  }

  if (company.userType === 'admin') {
    const { error: companyUpdateError } = await admin
      .from('companies')
      .update({
        business_size: input.businessSize,
        planning_horizon: input.planningHorizon,
      })
      .eq('id', company.id)

    if (companyUpdateError) {
      throw new ApiError(500, 'INTERNAL_ERROR', 'Could not save company settings.')
    }
  }

  const { data: preferenceRow, error: preferenceError } = await admin
    .from('user_gen_ui_preferences')
    .upsert(
      {
        user_id: userId,
        decision_role: input.decisionRole,
        priority_topics: [...new Set(input.priorityTopics)],
        detail_level: input.detailLevel,
        learn_from_history: input.learnFromHistory,
      },
      { onConflict: 'user_id' }
    )
    .select('*')
    .single()

  if (preferenceError) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Could not save your AI-BOSS preferences.'
    )
  }

  return toPersonalization(
    company.userType === 'admin' ? input.businessSize : currentBusinessSize,
    company.userType === 'admin'
      ? input.planningHorizon
      : currentPlanningHorizon,
    company.userType === 'admin',
    preferenceRow as UserGenUiPreferences
  )
}
