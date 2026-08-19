import { z } from 'zod'
import { ApiError } from '@/lib/api/errors'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { listFinancialMetricObservations } from '@/lib/financial-data/persistence'
import { isScenarioAnalysisResult } from '@/lib/scenarios/calculation'
import { ScenarioAnalysisInputSchema } from '@/lib/scenarios/schema'
import {
  analyseScenario,
  getScenarioSourceKey,
  isScenarioBaselineMetricKey,
} from '@/lib/scenarios/service'
import type {
  SavedScenario,
  ScenarioStatus,
  ScenarioVisibility,
} from '@/types/database'

const SAVED_SCENARIO_SELECT = `
  id, user_id, company_id, name, description, status, visibility,
  input_payload, result_payload, baseline_fingerprint, calculated_at,
  created_at, updated_at
`

const SavedScenarioMutationSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).nullable().optional(),
  status: z.enum(['draft', 'calculated']),
  visibility: z.enum(['private', 'company']),
  input: z.record(z.string(), z.unknown()),
  recalculate: z.boolean().optional().default(false),
})

export type SavedScenarioMutation = z.infer<typeof SavedScenarioMutationSchema>

export interface SavedScenarioView extends SavedScenario {
  isOwner: boolean
  isStale: boolean | null
}

function asSavedScenario(row: unknown) {
  return row as SavedScenario
}

async function getCompanyIdForUser(userId: string) {
  const supabase = createAdminSupabaseClient()
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('company_name')
    .eq('id', userId)
    .single()

  const companyName = typeof profile?.company_name === 'string'
    ? profile.company_name.trim()
    : ''
  if (profileError || !companyName) {
    throw new ApiError(400, 'BAD_REQUEST', 'A company profile is required to save scenarios.')
  }

  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id')
    .ilike('name', companyName)
    .limit(1)
    .single()

  if (companyError || !company?.id) {
    throw new ApiError(400, 'BAD_REQUEST', 'The user company could not be resolved.')
  }
  return company.id as string
}

function sameFingerprint(
  stored: Array<{ id: string; updatedAt: string }>,
  current: Array<{ id: string; updatedAt: string }>
) {
  const normalize = (items: Array<{ id: string; updatedAt: string }>) =>
    [...items].sort((left, right) => left.id.localeCompare(right.id))
  return JSON.stringify(normalize(stored)) === JSON.stringify(normalize(current))
}

async function currentFingerprint(userId: string, scenario: SavedScenario) {
  const parsed = ScenarioAnalysisInputSchema.safeParse(scenario.input_payload)
  if (!parsed.success) return []
  const observations = await listFinancialMetricObservations(userId)
  return observations
    .filter((row) =>
      getScenarioSourceKey(row) === parsed.data.sourceKey &&
      row.currency === parsed.data.currency &&
      isScenarioBaselineMetricKey(row.metric_key)
    )
    .map((row) => ({ id: row.id, updatedAt: row.updated_at }))
    .sort((left, right) => left.id.localeCompare(right.id))
}

async function toView(row: SavedScenario, requestingUserId: string): Promise<SavedScenarioView> {
  const isOwner = row.user_id === requestingUserId
  const isStale = row.status !== 'calculated' || !row.result_payload
    ? null
    : isOwner
      ? !sameFingerprint(row.baseline_fingerprint, await currentFingerprint(requestingUserId, row))
      : null
  return { ...row, isOwner, isStale }
}

async function assertAccessibleScenario(scenarioId: string, userId: string) {
  const supabase = createAdminSupabaseClient()
  const companyId = await getCompanyIdForUser(userId)
  const { data, error } = await supabase
    .from('scenarios')
    .select(SAVED_SCENARIO_SELECT)
    .eq('id', scenarioId)
    .single()
  if (error || !data) throw new ApiError(404, 'NOT_FOUND', 'Scenario not found.')
  const scenario = asSavedScenario(data)
  if (
    scenario.user_id !== userId &&
    !(scenario.visibility === 'company' && scenario.company_id === companyId)
  ) {
    throw new ApiError(404, 'NOT_FOUND', 'Scenario not found.')
  }
  return scenario
}

function validateMutation(raw: unknown) {
  const parsed = SavedScenarioMutationSchema.safeParse(raw)
  if (!parsed.success) {
    throw new ApiError(400, 'BAD_REQUEST', 'The saved scenario details are invalid.', parsed.error.flatten())
  }
  if (parsed.data.status === 'draft' && parsed.data.visibility !== 'private') {
    throw new ApiError(400, 'BAD_REQUEST', 'Incomplete drafts must remain private.')
  }
  return parsed.data
}

async function calculateSavedPayload(userId: string, mutation: SavedScenarioMutation) {
  if (mutation.status === 'draft') {
    return { result: null, fingerprint: [], calculatedAt: null }
  }
  const input = ScenarioAnalysisInputSchema.safeParse(mutation.input)
  if (!input.success) {
    throw new ApiError(400, 'BAD_REQUEST', 'A calculated scenario requires complete valid assumptions.', input.error.flatten())
  }
  const result = await analyseScenario(userId, input.data)
  return {
    result,
    fingerprint: result.metricInputs.observationFingerprint,
    calculatedAt: result.calculatedAt,
  }
}

function sameInput(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right)
}

export async function listSavedScenarios(userId: string) {
  const supabase = createAdminSupabaseClient()
  const companyId = await getCompanyIdForUser(userId)
  const { data, error } = await supabase
    .from('scenarios')
    .select(SAVED_SCENARIO_SELECT)
    .or(`user_id.eq.${userId},and(visibility.eq.company,company_id.eq.${companyId})`)
    .order('updated_at', { ascending: false })
  if (error) throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to load saved scenarios.')
  return Promise.all((data ?? []).map((row) => toView(asSavedScenario(row), userId)))
}

export async function getSavedScenario(scenarioId: string, userId: string) {
  return toView(await assertAccessibleScenario(scenarioId, userId), userId)
}

export async function createSavedScenario(userId: string, raw: unknown) {
  const mutation = validateMutation(raw)
  const calculated = await calculateSavedPayload(userId, mutation)
  const companyId = await getCompanyIdForUser(userId)
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('scenarios')
    .insert({
      user_id: userId,
      company_id: companyId,
      name: mutation.name,
      description: mutation.description || null,
      status: mutation.status,
      visibility: mutation.visibility,
      input_payload: mutation.input,
      result_payload: calculated.result,
      baseline_fingerprint: calculated.fingerprint,
      calculated_at: calculated.calculatedAt,
    })
    .select(SAVED_SCENARIO_SELECT)
    .single()
  if (error || !data) throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to save the scenario.')
  return toView(asSavedScenario(data), userId)
}

export async function updateSavedScenario(scenarioId: string, userId: string, raw: unknown) {
  const existing = await assertAccessibleScenario(scenarioId, userId)
  if (existing.user_id !== userId) throw new ApiError(403, 'FORBIDDEN', 'Only the scenario owner can edit it.')
  const mutation = validateMutation(raw)
  let calculated: Awaited<ReturnType<typeof calculateSavedPayload>>
  if (mutation.status === 'draft') {
    calculated = await calculateSavedPayload(userId, mutation)
  } else if (mutation.recalculate) {
    calculated = await calculateSavedPayload(userId, mutation)
  } else {
    if (
      existing.status !== 'calculated' ||
      !existing.result_payload ||
      !existing.calculated_at ||
      !sameInput(existing.input_payload, mutation.input)
    ) {
      throw new ApiError(
        400,
        'BAD_REQUEST',
        'Changed assumptions must be explicitly recalculated before saving a calculated result.'
      )
    }
    calculated = {
      result: existing.result_payload,
      fingerprint: existing.baseline_fingerprint,
      calculatedAt: existing.calculated_at,
    }
  }
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('scenarios')
    .update({
      name: mutation.name,
      description: mutation.description || null,
      status: mutation.status,
      visibility: mutation.visibility,
      input_payload: mutation.input,
      result_payload: calculated.result,
      baseline_fingerprint: calculated.fingerprint,
      calculated_at: calculated.calculatedAt,
    })
    .eq('id', scenarioId)
    .eq('user_id', userId)
    .select(SAVED_SCENARIO_SELECT)
    .single()
  if (error || !data) throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to update the scenario.')
  return toView(asSavedScenario(data), userId)
}

export async function deleteSavedScenario(scenarioId: string, userId: string) {
  const existing = await assertAccessibleScenario(scenarioId, userId)
  if (existing.user_id !== userId) throw new ApiError(403, 'FORBIDDEN', 'Only the scenario owner can delete it.')
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase.from('scenarios').delete().eq('id', scenarioId).eq('user_id', userId)
  if (error) throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to delete the scenario.')
}

export async function duplicateSavedScenario(scenarioId: string, userId: string) {
  const source = await assertAccessibleScenario(scenarioId, userId)
  const input = ScenarioAnalysisInputSchema.safeParse(source.input_payload)
  const safeInput = input.success
    ? {
        ...input.data,
        sourceKey: source.user_id === userId ? input.data.sourceKey : '',
        scenarios: input.data.scenarios,
      }
    : source.input_payload

  return createSavedScenario(userId, {
    name: `${source.name} copy`.slice(0, 80),
    description: source.description,
    status: 'draft' satisfies ScenarioStatus,
    visibility: 'private' satisfies ScenarioVisibility,
    input: safeInput,
  })
}

export function hasValidSavedScenarioResult(value: unknown) {
  return isScenarioAnalysisResult(value)
}
