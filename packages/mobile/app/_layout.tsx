import { useEffect, useState } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useAuthStore, clearPersistedAuth } from '../src/store/auth.store'
import { hydrateCache, startCachePersister } from '../src/lib/offline-cache'
import { syncPushTokenWithBackend } from '../src/lib/push-notifications'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 1,
      // Keep data available offline — serve cached data while refetching.
      networkMode: 'offlineFirst',
    },
    mutations: {
      networkMode: 'offlineFirst',
    },
  },
})

function InitialLayout() {
  const { user } = useAuthStore()
  const segments = useSegments()
  const router = useRouter()
  const [hydrated, setHydrated] = useState(false)

  // On every cold start we wipe any persisted auth state and start with an
  // empty session. This is by product decision: the user must log in each
  // time they open the app — there is no "remember me" or silent refresh.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await hydrateCache(queryClient)
      } catch {
        // non-fatal — fresh start
      }
      if (cancelled) return

      // Clear any legacy persisted session from earlier builds that used
      // zustand-persist. Safe to call even when nothing is stored.
      try {
        await clearPersistedAuth()
      } catch {
        // ignore
      }

      if (!cancelled) setHydrated(true)
    })()
    return () => { cancelled = true }
  }, [])

  // Start cache persister once the app is ready.
  useEffect(() => {
    if (!hydrated) return
    return startCachePersister(queryClient)
  }, [hydrated])

  // Register push token when the user is authenticated.
  useEffect(() => {
    if (!user) return
    syncPushTokenWithBackend()
  }, [user?.id])

  // Guard: redirect based on auth state. Wait until clearPersistedAuth
  // finishes so the router doesn't flicker through a phantom session.
  useEffect(() => {
    if (!hydrated) return
    if (!segments.length) return

    const inAuth = segments[0] === '(auth)'
    if (!user && !inAuth) {
      router.replace('/(auth)/login')
    } else if (user && inAuth) {
      router.replace('/(app)')
    }
  }, [user, segments, hydrated])

  return (
    <Stack screenOptions={{ headerShown: false }} />
  )
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <InitialLayout />
      </QueryClientProvider>
    </GestureHandlerRootView>
  )
}
