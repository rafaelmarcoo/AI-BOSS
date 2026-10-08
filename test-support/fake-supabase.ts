import { createAdminSupabaseClient } from '@/lib/supabase'

export interface Operation {
  table: string
  action: 'select' | 'insert' | 'update' | 'delete'
  payload?: unknown
  filters: Array<[string, unknown]>
}

export type Result = { data?: unknown; error?: { code?: string; message: string } | null }

export function fakeDatabase(respond: (operation: Operation, operations: Operation[]) => Result) {
  const operations: Operation[] = []
  const client = {
    from(table: string) {
      const operation: Operation = { table, action: 'select', filters: [] }
      const builder = {
        select: () => builder,
        or: () => builder,
        order: () => builder,
        single: () => builder,
        eq: (column: string, value: unknown) => {
          operation.filters.push([column, value])
          return builder
        },
        insert: (payload: unknown) => Object.assign(operation, { action: 'insert', payload }) && builder,
        update: (payload: unknown) => Object.assign(operation, { action: 'update', payload }) && builder,
        delete: () => Object.assign(operation, { action: 'delete' }) && builder,
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
          operations.push(operation)
          const result = respond(operation, operations)
          return Promise.resolve({ data: result.data ?? null, error: result.error ?? null }).then(resolve, reject)
        },
      }
      return builder
    },
  }
  jest.mocked(createAdminSupabaseClient).mockReturnValue(client as unknown as ReturnType<typeof createAdminSupabaseClient>)
  return operations
}
