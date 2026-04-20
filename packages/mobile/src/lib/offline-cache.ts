import AsyncStorage from '@react-native-async-storage/async-storage'
import type { QueryClient } from '@tanstack/react-query'

/**
 * Lightweight offline cache for mobile.
 *
 * TanStack Query's first-party persister is a separate dep (`@tanstack/react-query-persist-client`)
 * — to avoid adding a package right now, we roll a small hydrate/persist pair that snapshots the
 * query results we care about (lists) into AsyncStorage and hydrates on startup.
 */

const CACHE_PREFIX = 'lms:qcache:'
const CACHED_KEYS = ['leads', 'schools', 'tasks', 'dashboard'] as const

interface Snapshot {
  savedAt: number
  data: unknown
}

export async function hydrateCache(qc: QueryClient) {
  const keys = await AsyncStorage.getAllKeys()
  const ours = keys.filter((k) => k.startsWith(CACHE_PREFIX))
  if (ours.length === 0) return
  const pairs = await AsyncStorage.multiGet(ours)
  for (const [storageKey, value] of pairs) {
    if (!value) continue
    try {
      const { data, savedAt } = JSON.parse(value) as Snapshot
      // 24h TTL — anything older is dropped rather than shown stale.
      if (Date.now() - savedAt > 24 * 60 * 60 * 1000) {
        AsyncStorage.removeItem(storageKey).catch(() => {})
        continue
      }
      const queryKey = JSON.parse(storageKey.slice(CACHE_PREFIX.length))
      qc.setQueryData(queryKey, data)
    } catch {
      // corrupted entry — drop it
      AsyncStorage.removeItem(storageKey).catch(() => {})
    }
  }
}

/**
 * Subscribe to the query cache and snapshot whitelisted list-queries on every update.
 * Returns an unsubscribe fn.
 */
export function startCachePersister(qc: QueryClient) {
  return qc.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated') return
    const query = event.query
    if (query.state.status !== 'success') return
    const rootKey = Array.isArray(query.queryKey) ? query.queryKey[0] : undefined
    if (typeof rootKey !== 'string' || !CACHED_KEYS.includes(rootKey as any)) return
    const storageKey = CACHE_PREFIX + JSON.stringify(query.queryKey)
    const payload: Snapshot = { savedAt: Date.now(), data: query.state.data }
    AsyncStorage.setItem(storageKey, JSON.stringify(payload)).catch(() => {})
  })
}

export async function clearOfflineCache() {
  const keys = await AsyncStorage.getAllKeys()
  const ours = keys.filter((k) => k.startsWith(CACHE_PREFIX))
  if (ours.length) await AsyncStorage.multiRemove(ours)
}
