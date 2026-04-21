import { useEffect, useState } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { QueryClient, focusManager } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import AsyncStorage from '@react-native-async-storage/async-storage'
import axios from 'axios'
import Constants from 'expo-constants'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useAuthStore } from '../src/store/auth.store'
import { setupOnlineManager } from '../src/lib/online-manager'
import { registerMutationDefaults } from '../src/lib/mutation-defaults'
import { syncPushTokenWithBackend } from '../src/lib/push-notifications'

const BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl ?? 'http://localhost:3001/api'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      // Cached data survives 7 days on disk before being evicted on hydrate.
      // Longer than staleTime so offline users see last-known-good data even
      // if they haven't opened the app in a while.
      gcTime: 1000 * 60 * 60 * 24 * 7,
      retry: 1,
      // Serve cached data + refetch. When offline, queries stay paused instead
      // of erroring; the UI shows whatever is cached.
      networkMode: 'offlineFirst',
    },
    mutations: {
      // Same for mutations: while offline they pause, and are auto-resumed
      // by react-query when onlineManager flips back to online.
      networkMode: 'offlineFirst',
      retry: 2,
    },
  },
})

// AsyncStorage-backed persister. Buster is bumped when the cache shape changes
// incompatibly so old entries get thrown out instead of rehydrating broken state.
const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'lms:rq-cache',
  throttleTime: 1000,
})

// NetInfo → onlineManager + AppState → focusManager. Safe at module scope —
// subscribes once for the app lifetime.
setupOnlineManager()

// Register mutationFns for offline-capable mutations. MUST happen before
// <PersistQueryClientProvider> rehydrates — otherwise rehydrated paused
// mutations won't find their mutationFn and will silently drop on replay.
registerMutationDefaults(queryClient)

// Clear the persisted cache on explicit logout so the next user on this device
// doesn't hydrate into the previous user's data.
useAuthStore.subscribe((state, prev) => {
  if (prev.user && !state.user) {
    queryClient.clear()
    AsyncStorage.removeItem('lms:rq-cache').catch(() => {})
  }
})

function InitialLayout() {
  const { user } = useAuthStore()
  const segments = useSegments()
  const router = useRouter()
  const [hydrated, setHydrated] = useState(false)

  // Silently refresh the access token if a persisted refresh token exists —
  // this keeps the user signed in across app close/reopen (WhatsApp/Gmail-style).
  // On failure we clear state so the router sends them to /login.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
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
        } catch (err) {
          // Discriminate between network failure and real auth failure:
          //   - Network error (no response at all) → user is offline; keep
          //     the refreshToken on disk so they stay logged in and can see
          //     cached data. The response interceptor in api.ts will re-try
          //     a refresh next time a request actually hits the server.
          //   - 401/403 → refreshToken is truly invalid/revoked; logout so
          //     the user is sent to /login to re-authenticate.
          //   - Other statuses (5xx etc.) → treat as transient, don't logout.
          if (!cancelled && axios.isAxiosError(err)) {
            const status = err.response?.status
            if (status === 401 || status === 403) logout()
          }
        }
      }

      if (!cancelled) setHydrated(true)
    })()
    return () => { cancelled = true }
  }, [])

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
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          // 7 days — matches gcTime so nothing outlives the cache window.
          maxAge: 1000 * 60 * 60 * 24 * 7,
          // Bump this string when we change the cache shape in a backwards-
          // incompatible way (e.g. renaming a query key prefix). Old entries
          // with a different buster get evicted on next hydrate.
          buster: 'v1',
          dehydrateOptions: {
            // Persist success-only queries and paused mutations. Skip errored
            // queries — they're usually transient and replaying them can flash
            // stale error UI before the fresh fetch lands.
            shouldDehydrateQuery: (query) => query.state.status === 'success',
          },
        }}
        onSuccess={() => {
          // Cache is rehydrated + paused mutations are in memory — kick off
          // their replay. onlineManager gates this; when offline the calls
          // stay paused and re-fire as soon as NetInfo flips to reachable.
          queryClient.resumePausedMutations().then(() => {
            queryClient.invalidateQueries()
          })
          // Also trigger a focused refetch in case the app was backgrounded
          // during hydrate.
          focusManager.setFocused(true)
        }}
      >
        <InitialLayout />
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  )
}
