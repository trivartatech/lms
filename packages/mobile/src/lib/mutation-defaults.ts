import type { QueryClient } from '@tanstack/react-query'
import { api } from './api'

/**
 * Register `mutationFn`s for every offline-capable mutation at module scope,
 * BEFORE <PersistQueryClientProvider> rehydrates.
 *
 * Why: paused mutations are persisted with their `mutationKey` + `variables`
 * but NOT their `mutationFn` (functions aren't serializable). On rehydrate,
 * react-query looks up the mutationFn by mutationKey from the defaults
 * registered here. If a mutation's key isn't registered, the paused mutation
 * will rehydrate but silently fail to replay.
 *
 * Adding a new offline mutation:
 * 1. Pick a stable `mutationKey` tuple, e.g. ['leads', 'updateStage']
 * 2. Add a setMutationDefaults entry here with the real mutationFn
 * 3. In the component, `useOfflineMutation({ mutationKey, onSuccess, ... })`
 *    — keep the key identical and skip `mutationFn` (it's inherited from defaults)
 */

// Variables arriving here have an `_idempotencyKey` stamped by useOfflineMutation.
// We pull it off and pass it as a header; the rest of the payload becomes the body.
type WithKey<V> = V & { _idempotencyKey?: string }

function splitKey<V extends object>(vars: WithKey<V>): { body: V; headers: Record<string, string> } {
  const { _idempotencyKey, ...rest } = vars as WithKey<V> & Record<string, unknown>
  const headers: Record<string, string> = {}
  if (_idempotencyKey) headers['Idempotency-Key'] = _idempotencyKey as string
  return { body: rest as unknown as V, headers }
}

export function registerMutationDefaults(qc: QueryClient): void {
  // ── Tasks ──────────────────────────────────────────────────────────────────

  qc.setMutationDefaults(['tasks', 'complete'], {
    mutationFn: async (vars: WithKey<{ id: number }>) => {
      const { headers } = splitKey(vars)
      const { data } = await api.put(`/tasks/${vars.id}`, { status: 'COMPLETED' }, { headers })
      return data
    },
  })

  qc.setMutationDefaults(['tasks', 'reschedule'], {
    mutationFn: async (vars: WithKey<{ id: number; dueDate: string }>) => {
      const { headers } = splitKey(vars)
      const { data } = await api.put(`/tasks/${vars.id}`, { dueDate: vars.dueDate }, { headers })
      return data
    },
  })

  // Future entries (Stage 2+): leads/updateStage, leads/create, schools/update,
  // quotations/create, agreements/create, addons/create, tasks/create, etc.
}
