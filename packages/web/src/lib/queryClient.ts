import { QueryClient, MutationCache, QueryCache } from '@tanstack/react-query'
import { toast } from './toast-store'

function extractMessage(err: unknown): string {
  if (!err || typeof err !== 'object') return 'Unexpected error'
  const anyErr = err as any
  return (
    anyErr.response?.data?.message ??
    anyErr.response?.data?.error ??
    anyErr.message ??
    'Unexpected error'
  )
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
  queryCache: new QueryCache({
    onError: (err, query) => {
      // Only toast if this query has no component-level onError handler
      // and this isn't an auth redirect (the axios interceptor handles those).
      const status = (err as any)?.response?.status
      if (status === 401) return
      if (query.meta?.silent) return
      toast.error(extractMessage(err))
    },
  }),
  mutationCache: new MutationCache({
    onError: (err, _vars, _ctx, mutation) => {
      const status = (err as any)?.response?.status
      if (status === 401) return
      if (mutation.meta?.silent) return
      toast.error(extractMessage(err))
    },
    onSuccess: (_data, _vars, _ctx, mutation) => {
      const message = (mutation.meta as any)?.successMessage as string | undefined
      if (message) toast.success(message)
    },
  }),
})
