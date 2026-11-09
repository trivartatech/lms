
import type { MutationKey } from '@tanstack/react-query'

export function syncLabel(key?: MutationKey) {
  if (key?.[0] === 'tasks' && key[1] === 'complete') return 'Complete task'
  if (key?.[0] === 'tasks' && key[1] === 'reschedule') return 'Reschedule task'
  if (key?.[0] === 'operations' && key[1] === 'visit-note') return 'Update school visit'
  return undefined
}

export function syncError(error: unknown) {
  const e = error as { response?: { data?: { message?: string } }; message?: string } | null
  return e?.response?.data?.message ?? e?.message ?? 'The update could not be sent. You can retry it.'
}
