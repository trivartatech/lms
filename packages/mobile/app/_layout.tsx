import { useEffect, useState } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useAuthStore } from '../src/store/auth.store'
import { api } from '../src/lib/api'
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
  const { user, setAuth } = useAuthStore()
  const segments = useSegments()
  const router = useRouter()
  const [hydrated, setHydrated] = useState(false)

  // Hydrate the offline cache + try to restore session from stored refresh token.
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
        const refreshToken = await AsyncStorage.getItem('refreshToken')
        if (refreshToken && !user) {
          const { data } = await api.post('/auth/refresh')
          setAuth(data.accessToken, data.user)
        }
      } catch {
        // Not logged in — that's fine
      } finally {
        if (!cancelled) setHydrated(true)
      }
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
