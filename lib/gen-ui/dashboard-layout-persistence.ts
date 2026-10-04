import 'server-only'

import { ApiError } from '@/lib/api/errors'
import {
  DashboardLayoutPayloadSchema,
  type DashboardLayoutCreateInput,
  type DashboardLayoutUpdateInput,
} from '@/lib/gen-ui/dashboard-layout-schema'
import type { SavedDashboardLayout } from '@/lib/gen-ui/dashboard-layout-types'
import { createAdminSupabaseClient } from '@/lib/supabase'
import type { UserDashboardLayout } from '@/types/database'

function isUniqueViolation(error: { code?: string } | null) {
  return error?.code === '23505'
}

function toSavedLayout(row: UserDashboardLayout): SavedDashboardLayout {
  const payload = DashboardLayoutPayloadSchema.safeParse(row.layout_payload)
  if (!payload.success) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'A saved dashboard layout has an invalid configuration.',
    )
  }

  return {
    id: row.id,
    name: row.name,
    isDefault: row.is_default,
    sourcePlanVersion: row.source_plan_version,
    sourceGeneratedAt: row.source_generated_at,
    payload: payload.data,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listDashboardLayouts(
  userId: string,
): Promise<SavedDashboardLayout[]> {
  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('user_dashboard_layouts')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) {
    throw new ApiError(500, 'INTERNAL_ERROR', 'Could not load dashboard layouts.')
  }

  return ((data ?? []) as UserDashboardLayout[]).map(toSavedLayout)
}

export async function createDashboardLayout(
  userId: string,
  input: DashboardLayoutCreateInput,
): Promise<SavedDashboardLayout> {
  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('user_dashboard_layouts')
    .insert({
      user_id: userId,
      name: input.name,
      is_default: input.isDefault,
      source_plan_version: input.sourcePlanVersion,
      source_generated_at: input.sourceGeneratedAt,
      layout_payload: input.payload,
    })
    .select('*')
    .single()

  if (isUniqueViolation(error)) {
    throw new ApiError(409, 'CONFLICT', 'A layout with that name already exists.')
  }
  if (error || !data) {
    throw new ApiError(500, 'INTERNAL_ERROR', 'Could not save the dashboard layout.')
  }

  return toSavedLayout(data as UserDashboardLayout)
}

export async function updateDashboardLayout(
  userId: string,
  layoutId: string,
  input: DashboardLayoutUpdateInput,
): Promise<SavedDashboardLayout> {
  const changes = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.isDefault !== undefined ? { is_default: input.isDefault } : {}),
    ...(input.sourcePlanVersion !== undefined
      ? { source_plan_version: input.sourcePlanVersion }
      : {}),
    ...(input.sourceGeneratedAt !== undefined
      ? { source_generated_at: input.sourceGeneratedAt }
      : {}),
    ...(input.payload !== undefined ? { layout_payload: input.payload } : {}),
  }

  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('user_dashboard_layouts')
    .update(changes)
    .eq('id', layoutId)
    .eq('user_id', userId)
    .select('*')
    .maybeSingle()

  if (isUniqueViolation(error)) {
    throw new ApiError(409, 'CONFLICT', 'A layout with that name already exists.')
  }
  if (error) {
    throw new ApiError(500, 'INTERNAL_ERROR', 'Could not update the dashboard layout.')
  }
  if (!data) {
    throw new ApiError(404, 'NOT_FOUND', 'Dashboard layout not found.')
  }

  return toSavedLayout(data as UserDashboardLayout)
}

export async function deleteDashboardLayout(
  userId: string,
  layoutId: string,
) {
  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('user_dashboard_layouts')
    .delete()
    .eq('id', layoutId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'INTERNAL_ERROR', 'Could not delete the dashboard layout.')
  }
  if (!data) {
    throw new ApiError(404, 'NOT_FOUND', 'Dashboard layout not found.')
  }
}
