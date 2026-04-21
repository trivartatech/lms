import NetInfo, { type NetInfoState } from '@react-native-community/netinfo'
import { AppState, type AppStateStatus } from 'react-native'
import { focusManager, onlineManager } from '@tanstack/react-query'

/**
 * Bridge React Query's onlineManager + focusManager to React Native lifecycle.
 *
 * - NetInfo state → onlineManager.setOnline(): while offline, mutations with
 *   `networkMode: 'offlineFirst'` pause instead of failing. When we flip back
 *   to online, paused mutations automatically resume in order.
 * - AppState changes → focusManager.setFocused(): when the user returns to the
 *   app from background we trigger refetch of stale queries.
 *
 * Idempotent — calling setup() multiple times unsubscribes the previous
 * listeners first. Returns a cleanup function for tests.
 */

let cleanup: (() => void) | null = null

export function setupOnlineManager(): () => void {
  cleanup?.()

  // NetInfo → onlineManager. We treat "isInternetReachable" as the source of
  // truth when available (the device might be on a WiFi that can't actually
  // reach the internet), falling back to `isConnected` while it's unknown
  // (null) during initial detection.
  const unsubNet = NetInfo.addEventListener((state: NetInfoState) => {
    const reachable =
      state.isInternetReachable === null
        ? !!state.isConnected
        : state.isInternetReachable !== false && !!state.isConnected
    onlineManager.setOnline(reachable)
  })

  // AppState → focusManager. Only flip focused=true when the app comes to the
  // foreground; letting it stay true on blur is the library default and is fine.
  const handleAppState = (status: AppStateStatus) => {
    if (status === 'active') focusManager.setFocused(true)
  }
  const appStateSub = AppState.addEventListener('change', handleAppState)

  cleanup = () => {
    unsubNet()
    appStateSub.remove()
  }
  return cleanup
}
