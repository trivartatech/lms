import {
  useMutation,
  type UseMutationOptions,
  type UseMutationResult,
  type MutationKey,
} from '@tanstack/react-query'
import { uuidv4 } from '@/lib/uuid'

/**
 * useOfflineMutation — thin wrapper over useMutation that makes a mutation
 * survivable across offline → online transitions and app restarts.
 *
 * How it works:
 * - `mutationKey` is REQUIRED. TanStack Query's persister only rehydrates
 *   paused mutations that have a stable key registered via
 *   `queryClient.setMutationDefaults(mutationKey, { mutationFn })`. Register
 *   all offline-capable mutations in `registerMutationDefaults` below, and
 *   keep the key here identical.
 *
 * - Idempotency key stability: we stamp a UUID into `variables._idempotencyKey`
 *   at call-time. The registered `mutationFn` reads that field and passes it
 *   as the `Idempotency-Key` header so replays (after network flip or cold
 *   start) use the same key the first attempt used. This lets the backend
 *   idempotency middleware short-circuit duplicate replays with the original
 *   response.
 *
 *   We can't generate the key inside `mutationFn` — that function re-runs
 *   on each replay and would produce fresh keys. We can't generate it inside
 *   `onMutate` either — onMutate doesn't fire on cold-start replay of a
 *   persisted paused mutation (no component is mounted). Stamping into
 *   `variables` works because variables ARE persisted by the query cache.
 *
 * - Same-session UI callbacks (modal close, toast on error) can still be
 *   passed as `onSuccess` / `onError` — they only fire for mutations that
 *   settle while the component is still mounted. Cold-start replays finish
 *   silently; the blanket `invalidateQueries()` in _layout.tsx's onSuccess
 *   handler refreshes the UI once the queue drains.
 */

// Internal marker field stamped into variables. Underscore-prefixed to avoid
// colliding with any real payload field.
export type VarsWithIdempotency<V> = V & { _idempotencyKey?: string }

export interface OfflineMutationOptions<TData, TError, TVars, TContext>
  extends Omit<
    UseMutationOptions<TData, TError, VarsWithIdempotency<TVars>, TContext>,
    'mutationKey'
  > {
  mutationKey: MutationKey
}

export function useOfflineMutation<
  TData = unknown,
  TError = Error,
  TVars = void,
  TContext = unknown,
>(
  options: OfflineMutationOptions<TData, TError, TVars, TContext>,
): UseMutationResult<TData, TError, TVars, TContext> {
  const mutation = useMutation<TData, TError, VarsWithIdempotency<TVars>, TContext>(options)

  // Stamp a stable idempotency key into variables before handing them off to
  // react-query. Once stamped, the same key rides along through persist →
  // pause → resume → replay, so every attempt hits the backend with the same
  // header and the idempotency middleware can dedupe.
  const stamp = (vars: TVars): VarsWithIdempotency<TVars> => {
    const v = vars as VarsWithIdempotency<TVars> | undefined
    if (v && v._idempotencyKey) return v
    return { ...(vars as object), _idempotencyKey: uuidv4() } as VarsWithIdempotency<TVars>
  }

  const wrappedMutate: UseMutationResult<TData, TError, TVars, TContext>['mutate'] = (
    variables,
    mutateOptions,
  ) => {
    return mutation.mutate(stamp(variables as TVars), mutateOptions as any)
  }
  const wrappedMutateAsync: UseMutationResult<TData, TError, TVars, TContext>['mutateAsync'] = (
    variables,
    mutateOptions,
  ) => {
    return mutation.mutateAsync(stamp(variables as TVars), mutateOptions as any)
  }

  return {
    ...(mutation as unknown as UseMutationResult<TData, TError, TVars, TContext>),
    mutate: wrappedMutate,
    mutateAsync: wrappedMutateAsync,
  }
}
