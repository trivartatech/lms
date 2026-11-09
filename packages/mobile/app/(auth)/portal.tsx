import { useMemo, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import axios from 'axios'
import { useQuery } from '@tanstack/react-query'
import { create } from 'zustand'
import type { WorkspacePage } from '@lms/shared'
import { WorkspaceButton, WorkspaceView, workspaceError } from '@/components/workspace/WorkspaceView'
import { registerForPushAsync } from '@/lib/push-notifications'
import { C } from '@/lib/colors'
import { api } from '@/lib/api'

const usePortalSession = create<{ token: string; version: number; setToken: (token: string) => void }>(set => ({
  token: '', version: 0, setToken: token => set(state => ({ token, version: state.version + 1 })),
}))

export default function SchoolPortalScreen() {
  const router = useRouter()
  const { ticket } = useLocalSearchParams<{ ticket?: string }>()
  const { token, version, setToken } = usePortalSession()
  const [code, setCode] = useState('')
  const [alertMessage, setAlertMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const client = useMemo(() => axios.create({
    baseURL: api.defaults.baseURL, headers: { Authorization: 'Bearer ' + token }, timeout: 20_000,
  }), [token])
  const page = useQuery<WorkspacePage>({
    queryKey: ['school-portal-session', version], enabled: !!token, queryFn: () => client.get('/portal').then(r => r.data),
    gcTime: 0, retry: false, refetchInterval: 30_000, meta: { skipPersist: true },
  })
  const accessStatus = axios.isAxiosError(page.error) ? page.error.response?.status : undefined
  const signedIn = !!token && !!page.data && accessStatus !== 401 && accessStatus !== 403

  async function updateAlerts(enable: boolean) {
    setBusy(true)
    setAlertMessage('')
    try {
      const deviceToken = await registerForPushAsync(enable)
      if (!deviceToken) {
        setAlertMessage(enable ? 'Enable notifications in your phone settings to receive alerts.' : 'Phone alerts are unavailable on this device.')
        return
      }
      const response = await client.request<{ message: string }>({
        url: '/portal/tickets/push-token', method: enable ? 'POST' : 'DELETE', data: { token: deviceToken },
      })
      setAlertMessage(response.data.message)
    } catch (error) { setAlertMessage(workspaceError(error)) }
    finally { setBusy(false) }
  }

  async function signOut() {
    setBusy(true)
    try {
      const deviceToken = await registerForPushAsync(false)
      if (deviceToken) await client.delete('/portal/tickets/push-token', { data: { token: deviceToken }, timeout: 4000 })
    } catch { /* The local session can end even when the device is offline. */ }
    finally {
      setToken('')
      setCode('')
      setAlertMessage('')
      router.setParams({ ticket: '' })
      setBusy(false)
    }
  }

  function openLink(link: string) {
    const match = /^\/portal\?ticket=(\d+)$/.exec(link)
    if (match) router.setParams({ ticket: match[1] })
  }

  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, paddingTop: 60, gap: 14, flexGrow: 1, backgroundColor: '#fff' }}>
    <Text style={{ fontSize: 24, fontWeight: '700', color: C.text }}>LMS School Portal</Text>
    {signedIn ? <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <WorkspaceButton title="Enable phone alerts" secondary disabled={busy} onPress={() => void updateAlerts(true)} />
        <WorkspaceButton title="Turn off phone alerts" secondary disabled={busy} onPress={() => void updateAlerts(false)} />
        <WorkspaceButton title="Sign out" secondary disabled={busy} onPress={() => void signOut()} />
      </View>
      {!!alertMessage && <Text accessibilityLiveRegion="polite" style={{ color: C.textSecondary }}>{alertMessage}</Text>}
      {!!ticket && <WorkspaceButton title="Show all portal records" secondary onPress={() => router.setParams({ ticket: '' })} />}
      {page.data && <WorkspaceView key={version} page={page.data} client={client} onChange={() => void page.refetch()}
        record={ticket ? 'ticket-' + ticket : undefined} openTicket={ticket} onLink={openLink}
        onChatDismiss={() => { if (ticket) router.setParams({ ticket: '' }) }} />}
    </> : <>
      <Text style={{ color: C.textSecondary }}>{ticket ? 'Enter your school access code to open the ticket conversation.' : 'Enter the access code issued to your school contact.'}</Text>
      <TextInput accessibilityLabel="School access code" secureTextEntry autoCapitalize="none" autoCorrect={false} value={code} onChangeText={setCode}
        style={{ borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 12, color: C.text }} />
      {page.isFetching && <ActivityIndicator color={C.primary} />}
      {page.isError && <Text accessibilityLiveRegion="polite" style={{ color: C.error }}>Could not open school access. Check the code or contact your school representative.</Text>}
      <WorkspaceButton title="Open school portal" disabled={!code.trim() || page.isFetching} onPress={() => { setToken(code.trim()); setCode('') }} />
      <WorkspaceButton title="Staff sign-in" secondary onPress={() => router.replace('/(auth)/login')} />
    </>}
  </ScrollView>
}
