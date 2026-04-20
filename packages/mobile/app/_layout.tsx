import { useEffect, useState } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useAuthStore } from '../src/store/auth.store'
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

  // Hydrate the offline cache. Session is intentionally NOT restored — we
  // require the user to log in again every time the app is re-opened, so any
  // previously-stored refresh token is cleared here on boot.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await hydrateCache(queryClient)
      } catch {
        // non-fatal — fresh start
      }
      if (cancelled) return

      try {
        await AsyncStorage.removeItem('refreshToken')
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

  // Guard: redirect based on auth state
  // segments.length === 0 means the navigator isn't ready yet — skip
  useEffect(() => {
    if (!segments.length) return

    const inAuth = segments[0] === '(auth)'
    if (!user && !inAuth) {
      router.replace('/(auth)/login')
    } else if (user && inAuth) {
      router.replace('/(app)')
    }
  }, [user, segments])

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
