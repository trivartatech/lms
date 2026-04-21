import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { onlineManager, useIsMutating } from '@tanstack/react-query'
import { CloudOff, RotateCw } from 'lucide-react-native'
import { C } from '@/lib/colors'

/**
 * OfflineStatusPill — small header indicator that surfaces three states:
 *   1. Online & idle → null (nothing rendered, zero real-estate cost)
 *   2. Offline → "Offline" pill with N pending count
 *   3. Online but flushing paused mutations → "Syncing N" pill
 *
 * Subscribes directly to react-query's onlineManager so it flips within a
 * second of NetInfo registering a change (no poll). `useIsMutating()` counts
 * every mutation with `status: 'pending'` — and paused mutations are still
 * pending (just waiting on onlineManager to flip). So this single number
 * covers both in-flight and queued-offline actions without any double count.
 */

function useOnline(): boolean {
  const [online, setOnline] = useState(() => onlineManager.isOnline())
  useEffect(() => {
    // onlineManager.subscribe fires the listener with the new boolean on
    // every transition. Returning it here makes useEffect call its returned
    // unsubscribe on unmount.
    return onlineManager.subscribe((next) => {
      setOnline(next)
    })
  }, [])
  return online
}

export function OfflineStatusPill() {
  const online = useOnline()
  const pending = useIsMutating()

  // Happy path: online, nothing queued → render nothing so the header stays clean.
  if (online && pending === 0) return null

  if (!online) {
    return (
      <View style={[s.pill, s.offline]}>
        <CloudOff size={13} color={C.warningText} />
        <Text style={[s.text, s.offlineText]}>
          Offline{pending > 0 ? ` · ${pending}` : ''}
        </Text>
      </View>
    )
  }

  // Online with pending mutations → syncing.
  return (
    <View style={[s.pill, s.syncing]}>
      {pending > 0 ? (
        <ActivityIndicator size="small" color={C.info} />
      ) : (
        <RotateCw size={13} color={C.infoText} />
      )}
      <Text style={[s.text, s.syncingText]}>
        Syncing{pending > 0 ? ` ${pending}` : '…'}
      </Text>
    </View>
  )
}

const s = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginRight: 10,
  },
  offline: {
    backgroundColor: C.warningLight,
  },
  offlineText: {
    color: C.warningText,
  },
  syncing: {
    backgroundColor: C.infoLight,
  },
  syncingText: {
    color: C.infoText,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
  },
})
