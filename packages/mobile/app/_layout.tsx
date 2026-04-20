import { useEffect, useState } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import axios from 'axios'
import Constants from 'expo-constants'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useAuthStore } from '../src/store/auth.store'
import { hydrateCache, startCachePersister } from '../src/lib/offline-cache'
import { syncPushTokenWithBackend } from '../src/lib/push-notifications'

const BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl ?? 'http://localhost:3001/api'

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

  // Hydrate the offline cache and silently refresh the access token if a
  // persisted refresh token exists — this keeps the user signed in across
  // app close/reopen. On failure we clear state so the router sends them
  // to /login.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await hydrateCache(queryClient)
      } catch {
        // non-fatal — fresh start
      }
      if (cancelled) return

      // Wait for zustand-persist to finish pulling refreshToken + user from
      // AsyncStorage. Without this await we'd read an empty store on boot
      // and treat every cold start as a logged-out session.
      try {
        if (!useAuthStore.persist.hasHydrated()) {
          await useAuthStore.persist.rehydrate()
        }
      } catch {
        // ignore — fall through to logged-out path
      }
      if (cancelled) return

      const { refreshToken, setTokens, logout } = useAuthStore.getState()
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken })
          if (!cancelled) {
            setTokens(data.accessToken, data.refreshToken ?? refreshToken)
          }
        } catch {
          if (!cancelled) logout()
        }
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

  // Guard: redirect based on auth state. Wait until we've attempted to
  // restore the session (hydrated) so we don't bounce the user to /login
  // before the silent refresh completes.
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
