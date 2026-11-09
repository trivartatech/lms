
import { Alert, Pressable, ScrollView, Text, View } from 'react-native'
import { useMutationState, useQueryClient } from '@tanstack/react-query'
import { C } from '@/lib/colors'
import { syncError, syncLabel } from '@/lib/sync-queue'

type Vars = { id?: number; update?: { notes?: string; outcome?: string; checkIn?: boolean } }

export default function SyncQueueScreen() {
  const client = useQueryClient()
  const items = useMutationState({
    filters: { predicate: m => !!syncLabel(m.options.mutationKey) && ['error', 'pending'].includes(m.state.status) },
    select: m => ({
      id: m.mutationId, label: syncLabel(m.options.mutationKey), vars: m.state.variables as Vars | undefined,
      status: m.state.status, paused: m.state.isPaused, error: m.state.status === 'error' ? syncError(m.state.error) : null,
      submitted: m.state.submittedAt,
    }),
  })
  async function retry(id: number) {
    const mutation = client.getMutationCache().getAll().find(m => m.mutationId === id)
    if (mutation?.state.status !== 'error') return
    try {
      await mutation.execute(mutation.state.variables)
      await Promise.all([client.invalidateQueries({ queryKey: ['operations'] }), client.invalidateQueries({ queryKey: ['tasks'] })])
    } catch { /* The mutation stays visible with its latest error. */ }
  }
  function discard(id: number) {
    Alert.alert('Discard this local update?', 'The app will stop retrying this change.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => {
        const cache = client.getMutationCache()
        const mutation = cache.getAll().find(m => m.mutationId === id)
        if (mutation?.state.status === 'error') cache.remove(mutation)
      } },
    ])
  }
  return <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, gap: 12 }}>
    <Text style={{ color: C.textSecondary }}>Visit updates and task changes waiting to reach LMS appear here.</Text>
    {!items.length && <Text style={{ color: C.text, fontWeight: '600' }}>Everything is synced.</Text>}
    {items.slice().sort((a, b) => b.submitted - a.submitted).map(item => <View key={item.id}
      style={{ padding: 14, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, gap: 8 }}>
      <Text style={{ fontWeight: '700', color: C.text }}>{item.label}{item.vars?.id ? ' #' + item.vars.id : ''}</Text>
      <Text style={{ color: item.error ? C.error : C.textSecondary }}>{item.error ? 'Failed' : item.paused ? 'Pending connection' : 'Syncing'}</Text>
      {!!item.vars?.update?.notes && <Text>{item.vars.update.notes}</Text>}
      {!!item.vars?.update?.outcome && <Text>{item.vars.update.outcome}</Text>}
      {item.error && <>
        <Text style={{ color: C.error }}>{item.error}</Text>
        <View style={{ flexDirection: 'row', gap: 20 }}>
          <Pressable accessibilityRole="button" onPress={() => void retry(item.id)}><Text style={{ color: C.primary, fontWeight: '700' }}>Retry</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => discard(item.id)}><Text style={{ color: C.textSecondary }}>Discard</Text></Pressable>
        </View>
      </>}
    </View>)}
  </ScrollView>
}
