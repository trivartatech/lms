import { useState } from 'react'
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { WORKSPACE_MODULES, workspaceModules, type WorkspaceDirectory, type WorkspaceModule, type WorkspacePage } from '@lms/shared'
import { WorkspaceButton, WorkspaceChoice, WorkspaceView, workspaceError } from '@/components/workspace/WorkspaceView'
import { useAuthStore } from '@/store/auth.store'
import { api } from '@/lib/api'
import { C } from '@/lib/colors'

export default function AccountWorkspaceScreen() {
  const { module: requested, school = '', period = '', record = '' } = useLocalSearchParams<{ module?: WorkspaceModule; school?: string; period?: string; record?: string }>()
  const [month, setMonth] = useState(period)
  const router = useRouter()
  const client = useQueryClient()
  const role = useAuthStore(s => s.user?.role)
  const modules = workspaceModules(role)
  const module = requested && modules.includes(requested) ? requested : modules[0]
  const directory = useQuery<WorkspaceDirectory>({ queryKey: ['workspace', 'index'], meta: { skipPersist: true }, queryFn: () => api.get('/workspace/index').then(r => r.data) })
  const page = useQuery<WorkspacePage>({
    queryKey: ['workspace', module, school, period, record], meta: { skipPersist: true },
    queryFn: () => api.get('/workspace/' + module, { params: {
      schoolId: school || undefined, period: period || undefined, recordId: module === 'receipts' && /^\d+$/.test(record) ? record : undefined,
    } }).then(r => r.data),
  })
  function refresh() {
    for (const key of ['workspace', 'operations', 'tasks', 'agreements', 'quotations', 'schools', 'activity']) {
      void client.invalidateQueries({ queryKey: [key] })
    }
  }
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 12 }}>
    <WorkspaceChoice label="Account workspace" value={module} options={modules.map(value => ({ value, label: WORKSPACE_MODULES[value] }))}
      onChange={value => router.setParams({ module: value, record: '', school: value === 'inbox' ? '' : school })} />
    {module !== 'inbox' && module !== 'targets' && <WorkspaceChoice label="School" value={school}
      options={[{ value: '', label: module === 'portal' || module === 'timeline' ? 'Choose school' : 'All schools' },
        ...(directory.data?.schools ?? []).map(school => ({ value: String(school.id), label: school.name }))]}
      onChange={value => router.setParams({ school: value, record: '' })} />}
    {module === 'targets' && <View style={{ gap: 6 }}>
      <Text style={{ color: C.text }}>Target month</Text>
      <TextInput accessibilityLabel="Target month" placeholder="YYYY-MM" value={month} onChangeText={setMonth} maxLength={7}
        style={{ borderColor: C.border, borderWidth: 1, borderRadius: 8, padding: 10, color: C.text }} />
      <WorkspaceButton title="Apply month" secondary disabled={!!month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)}
        onPress={() => router.setParams({ period: month, record: '' })} />
    </View>}
    {!!record && <WorkspaceButton title="Clear record focus" secondary onPress={() => router.setParams({ record: '' })} />}
    {page.isLoading && <ActivityIndicator color={C.primary} />}
    {(page.isError || directory.isError) && <>
      <Text style={{ color: C.error }}>{workspaceError(page.error ?? directory.error)}</Text>
      <WorkspaceButton title="Retry" secondary onPress={() => { void page.refetch(); void directory.refetch() }} />
    </>}
    {page.data && <WorkspaceView key={module + school} page={page.data} client={api} record={record} onChange={refresh}
      onLink={path => router.push(('/(app)' + path) as never)} />}
  </ScrollView>
}
