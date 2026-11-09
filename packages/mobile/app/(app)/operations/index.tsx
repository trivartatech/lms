
import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import * as Location from 'expo-location'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import {
  SCHOOL_MODULES, SCHOOL_MODULE_LABELS, DOCUMENT_CATEGORIES, WORK_STATUSES, SCHOOL_FILE_MAX_BYTES,
  localDateInput, schoolDirections, matchesSupportQueue, SUPPORT_QUEUE_FILTERS, type SupportQueueFilter,
  type OperationsIndex, type OverdueInstalment, type SchoolFile, type SchoolFileUpload,
  type SchoolModule, type SchoolWork, type WorkUpdate,
} from '@lms/shared'
import { TicketChatButton } from '@/components/support/TicketChatButton'
import { useAuthStore } from '@/store/auth.store'
import { C } from '@/lib/colors'
import { api } from '@/lib/api'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils'
import { DatePickerField } from '@/components/shared/DatePickerField'
import { TimePickerField } from '@/components/shared/TimePickerField'
import { useOfflineMutation } from '@/hooks/useOfflineMutation'

function message(err: unknown) {
  return (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message
    ?? (err instanceof Error ? err.message : 'Please try again')
}
const showError = (e: unknown) => Alert.alert('Could not complete the action', message(e))

function Action({ title, onPress, disabled = false, secondary = false }: {
  title: string; onPress: () => void; disabled?: boolean; secondary?: boolean
}) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
    style={[s.action, secondary && s.secondary, disabled && { opacity: 0.45 }]}>
    <Text style={[s.actionText, secondary && { color: C.primary }]}>{title}</Text>
  </Pressable>
}

function Choices({ options, value, onChange, label }: {
  options: { value: string; label: string }[]; value: string; onChange: (v: string) => void; label: string
}) {
  return <View style={s.field}>
    <Text style={s.label}>{label}</Text>
    <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={s.choices}>
      {options.map(option => <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected: value === option.value }}
        onPress={() => onChange(option.value)} style={[s.chip, value === option.value && s.selected]}>
        <Text style={value === option.value ? s.selectedText : s.label}>{option.label}</Text>
      </Pressable>)}
    </ScrollView>
  </View>
}

function Field({ label, value, onChange, multiline = false }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  return <View style={s.field}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} style={[s.input, multiline && { minHeight: 70 }]}
    value={value} onChangeText={onChange} multiline={multiline} maxLength={multiline ? 4000 : 180} /></View>
}

function DateTime({ label, day, time, onDay, onTime }: { label: string; day: string; time: string; onDay: (d: string) => void; onTime: (t: string) => void }) {
  return <View style={s.field}><Text style={s.label}>{label}</Text>
    <DatePickerField value={day} onChange={onDay} /><TimePickerField value={time} onChange={onTime} />
  </View>
}
const asIso = (day: string, time: string) => new Date(day + 'T' + time + ':00').toISOString()

async function pickFile(imagesOnly: boolean, camera: boolean): Promise<SchoolFileUpload | undefined> {
  if (camera) {
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) throw new Error('Allow camera access in your device settings.')
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.45 })
    if (result.canceled) return
    const asset = result.assets[0]
    const file = new File(asset.uri)
    if (file.size > SCHOOL_FILE_MAX_BYTES) throw new Error('The photo must be 5 MB or smaller')
    return { name: 'Capture-' + Date.now() + '.jpg', mimeType: 'image/jpeg', base64: await file.base64() }
  }
  const result = await DocumentPicker.getDocumentAsync({
    type: imagesOnly ? ['image/jpeg', 'image/png'] : ['application/pdf', 'image/jpeg', 'image/png'],
    copyToCacheDirectory: true,
  })
  if (result.canceled) return
  const asset = result.assets[0]
  const file = new File(asset.uri)
  if (file.size > SCHOOL_FILE_MAX_BYTES) throw new Error('The file must be 5 MB or smaller')
  const mimeType = asset.mimeType ?? (/\.pdf$/i.test(asset.name) ? 'application/pdf' : /\.png$/i.test(asset.name) ? 'image/png' : 'image/jpeg')
  return { name: asset.name, mimeType, base64: await file.base64() }
}

async function openFile(record: SchoolFile) {
  let file: File | undefined
  try {
    if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is unavailable on this device')
    const response = await api.get<ArrayBuffer>('/operations/files/' + record.id, { responseType: 'arraybuffer' })
    file = new File(Paths.cache, record.id + '-' + Date.now() + '-' + record.name.replace(/[^a-zA-Z0-9._-]/g, '_'))
    file.write(new Uint8Array(response.data))
    await Sharing.shareAsync(file.uri, { mimeType: record.mimeType, dialogTitle: record.name })
  } catch (err) { showError(err) }
  finally { if (file?.exists) file.delete() }
}

function FileChooser({ file, onPick, imagesOnly = false }: { file?: SchoolFileUpload; onPick: (v: SchoolFileUpload) => void; imagesOnly?: boolean }) {
  const [busy, setBusy] = useState(false)
  async function choose(camera: boolean) {
    setBusy(true)
    try { const selected = await pickFile(imagesOnly, camera); if (selected) onPick(selected) }
    catch (err) { showError(err) }
    finally { setBusy(false) }
  }
  return <View style={s.field}>
    <View style={s.actions}><Action title="Choose file" secondary disabled={busy} onPress={() => void choose(false)} />
      <Action title={imagesOnly ? 'Take photo' : 'Capture document'} secondary disabled={busy} onPress={() => void choose(true)} /></View>
    {file && <Text style={s.meta}>{file.name}</Text>}
  </View>
}

function CreateForm({ module, directory, selectedSchool }: { module: SchoolModule; directory: OperationsIndex; selectedSchool: string }) {
  const client = useQueryClient()
  const [schoolId, setSchoolId] = useState(selectedSchool)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [day, setDay] = useState(localDateInput(new Date()))
  const [time, setTime] = useState('09:00')
  const [person, setPerson] = useState('')
  const [agreement, setAgreement] = useState('')
  const [category, setCategory] = useState<string>(DOCUMENT_CATEGORIES[0])
  const [file, setFile] = useState<SchoolFileUpload>()
  const agreements = useQuery<{ id: number; startDate: string; endDate: string }[]>({
    queryKey: ['operations', 'agreements', schoolId], enabled: module === 'onboarding' && !!schoolId,
    queryFn: () => api.get('/operations/agreements/' + schoolId).then(r => r.data),
  })
  const save = useMutation({
    mutationFn: () => {
      if (module === 'onboarding') return api.post('/operations/onboarding', { schoolId: Number(schoolId), agreementId: Number(agreement) })
      if (module === 'documents') return api.post('/operations/files', { ...file, schoolId: Number(schoolId), category }, { timeout: 60000 })
      return api.post('/operations/work/' + module, { schoolId: Number(schoolId), title, notes, dueAt: asIso(day, time), assignedToId: Number(person) || undefined })
    },
    retry: false,
    onSuccess: () => { setTitle(''); setNotes(''); setFile(undefined); void client.invalidateQueries({ queryKey: ['operations'] }); Alert.alert('Saved') },
    onError: showError,
  })
  const action = module === 'visits' ? 'Schedule visit' : module === 'support' ? 'Open ticket' : module === 'documents' ? 'Upload document' : 'Create checklist'
  return <View style={s.panel}>
    <Text style={s.heading}>{action}</Text>
    <Choices label="School" options={directory.schools.map(x => ({ value: String(x.id), label: x.name }))} value={schoolId}
      onChange={value => { setSchoolId(value); setAgreement('') }} />
    {module === 'onboarding' && <>
      <Choices label="Signed agreement" options={(agreements.data ?? []).map(a => ({ value: String(a.id), label: '#' + a.id + ' · ' + formatDate(a.startDate) }))} value={agreement} onChange={setAgreement} />
      {schoolId && agreements.isSuccess && !agreements.data.length ? <Text style={s.meta}>This school has no active agreements.</Text> : null}
    </>}
    {module === 'documents' && <>
      <Choices label="Category" options={DOCUMENT_CATEGORIES.map(c => ({ value: c, label: c }))} value={category} onChange={setCategory} />
      <Text style={s.meta}>PDF, JPEG or PNG up to 5 MB</Text><FileChooser file={file} onPick={setFile} />
    </>}
    {(module === 'support' || module === 'visits') && <>
      <Field label="Title" value={title} onChange={setTitle} />
      <DateTime label={module === 'support' ? 'Response deadline' : 'Visit date'} day={day} time={time} onDay={setDay} onTime={setTime} />
      {directory.canAssign && <Choices label="Assigned to" value={person} onChange={setPerson}
        options={[{ value: '', label: 'School owner' }, ...(module === 'support' ? directory.supportAssignees ?? [] : directory.assignees).map(p => ({ value: String(p.id), label: p.name }))]} />}
      <Field label="Notes" value={notes} onChange={setNotes} multiline />
    </>}
    <Action title={save.isPending ? 'Saving…' : action} disabled={save.isPending || !schoolId || (module === 'onboarding' ? !agreement : module === 'documents' ? !file : !title.trim() || !day)} onPress={() => save.mutate()} />
  </View>
}

function WorkCard({ item, directory, openChat, dismissChat }: {
  item: SchoolWork; directory: OperationsIndex; openChat: boolean; dismissChat: () => void
}) {
  const router = useRouter()
  const client = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [version, setVersion] = useState(item.updatedAt)
  const [status, setStatus] = useState(item.status)
  const [notes, setNotes] = useState(item.notes ?? '')
  const [outcome, setOutcome] = useState(item.outcome ?? '')
  const [assignedTo, setAssignedTo] = useState(String(item.assignedTo?.id ?? ''))
  const [task, setTask] = useState('')
  const [day, setDay] = useState('')
  const [time, setTime] = useState('09:00')
  const [photo, setPhoto] = useState<SchoolFileUpload>()
  const [history, setHistory] = useState(false)
  const [scheduledDay, setScheduledDay] = useState('')
  const [scheduledTime, setScheduledTime] = useState('09:00')
  const [locating, setLocating] = useState(false)
  const userId = useAuthStore(s => s.user?.id)
  const canHandoff = item.kind === 'support' && !!userId && item.assignedTo?.id === userId
  const supportStaff = directory.supportAssignees ?? []
  const assignees = item.kind !== 'support' ? directory.assignees :
    item.assignedTo && !supportStaff.some(person => person.id === item.assignedTo?.id) ? [item.assignedTo, ...supportStaff] : supportStaff
  const refresh = () => { void client.invalidateQueries({ queryKey: ['operations'] }); void client.invalidateQueries({ queryKey: ['tasks'] }); void client.invalidateQueries({ queryKey: ['workspace', 'inbox'] }) }
  const save = useOfflineMutation<unknown, Error, { id: number; update: WorkUpdate }>({
    mutationKey: ['operations', 'visit-note'],
    onSuccess: () => { refresh(); setEditing(false) },
    onError: () => { void client.invalidateQueries({ queryKey: ['operations'] }) },
  })
  const onlineSave = useMutation({
    mutationFn: (body: WorkUpdate) => api.patch('/operations/work/' + item.id, body),
    onSuccess: () => { refresh(); setEditing(false) }, onError: showError, retry: false,
  })
  const upload = useMutation({
    mutationFn: (f: SchoolFileUpload) => api.post('/operations/files', { ...f, schoolId: item.schoolId, workId: item.id }, { timeout: 60000 }),
    onSuccess: () => { refresh(); setPhoto(undefined) }, onError: showError, retry: false,
  })
  if (item.kind === 'collections') return null
  const directions = schoolDirections(item.school)
  const begin = () => {
    setVersion(item.updatedAt)
    setStatus(item.status); setNotes(item.notes ?? ''); setOutcome(item.outcome ?? '')
    setAssignedTo(String(item.assignedTo?.id ?? ''))
    if (item.dueAt) {
      const due = new Date(item.dueAt)
      setScheduledDay(localDateInput(due))
      setScheduledTime(String(due.getHours()).padStart(2, '0') + ':' + String(due.getMinutes()).padStart(2, '0'))
    }
    setEditing(true)
  }
  const commit = () => {
    if (item.kind === 'visits' && status === 'COMPLETED' && !outcome.trim()) return Alert.alert('Add a visit outcome')
    if (task.trim() && !day) return Alert.alert('Choose a follow-up date')
    const body: WorkUpdate = {
      expectedUpdatedAt: version, notes, dueAt: scheduledDay && asIso(scheduledDay, scheduledTime) !== item.dueAt ? asIso(scheduledDay, scheduledTime) : undefined, status: status === 'CHECKED_IN' ? undefined : status,
      assignedToId: (directory.canAssign || canHandoff) && assignedTo !== String(item.assignedTo?.id ?? '') ? Number(assignedTo) || null : undefined,
      outcome: item.kind === 'visits' ? outcome : undefined,
      followUp: task.trim() && day ? { title: task.trim(), dueAt: asIso(day, time) } : undefined,
    }
    if (item.kind === 'visits') {
      save.mutate({ id: item.id, update: body })
      setEditing(false)
    } else onlineSave.mutate(body)
  }
  const checkIn = async () => {
    const checkedInAt = new Date().toISOString()
    setLocating(true)
    let coords: Pick<WorkUpdate, 'latitude' | 'longitude'> = {}
    try {
      const permission = await Location.requestForegroundPermissionsAsync()
      if (permission.granted) {
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        coords = { latitude: position.coords.latitude, longitude: position.coords.longitude }
      }
    } catch { /* A timestamp is still useful when a location fix is unavailable. */ }
    finally { setLocating(false) }
    save.mutate({ id: item.id, update: { checkIn: true, checkedInAt, ...coords } })
  }
  return <View style={s.panel}>
    <Text style={s.heading}>{item.title}</Text>
    <Pressable onPress={() => router.push(('/(app)/workspace?module=timeline&school=' + item.schoolId) as never)}><Text style={s.link}>{item.school.name}</Text></Pressable>
    <Text style={s.meta}>{item.status.replaceAll('_', ' ')} · {item.assignedTo?.name ?? 'Unassigned'}</Text>
    {item.dueAt && <Text style={s.meta}>{item.kind === 'support' ? 'Response due' : 'Scheduled'} {formatDateTime(item.dueAt)}</Text>}
    {item.agreementId && <Text style={s.meta}>Agreement #{item.agreementId}</Text>}
    {item.checkedInAt && <Text style={s.meta}>Checked in {formatDateTime(item.checkedInAt)}</Text>}
    {item.supportCategory && <Text style={s.meta}>{item.supportCategory}</Text>}
    {matchesSupportQueue(item, 'waiting') && <Text style={s.meta}>Waiting for staff</Text>}
    {matchesSupportQueue(item, 'overdue') && <Text style={s.error}>Response overdue</Text>}
    {!!item.notes && <Text>{item.notes}</Text>}
    {!!item.outcome && <Text>Outcome · {item.outcome}</Text>}
    {item.followUpTaskId && <Pressable onPress={() => router.push('/(app)/tasks')}><Text style={s.link}>Follow-up task #{item.followUpTaskId}</Text></Pressable>}
    <View style={s.actions}>
      <Action title="Update" secondary onPress={begin} />
      {item.kind === 'support' && <TicketChatButton client={api} path={'/operations/work/' + item.id + '/messages'}
        title={item.title} openFromLink={openChat} onDismiss={dismissChat} />}
      {item.kind === 'visits' && directions && <Action title="Directions" secondary onPress={() => Linking.openURL(directions).catch(showError)} />}
      {item.kind === 'visits' && item.status === 'PLANNED' && <Action title={locating ? 'Locating…' : 'Check in'} disabled={locating || save.isPending} onPress={() => void checkIn()} />}
    </View>
    {editing && <>
      <Choices label="Status" value={status} onChange={setStatus}
        options={WORK_STATUSES[item.kind].filter(v => v !== 'CHECKED_IN' || item.status === 'CHECKED_IN').map(v => ({ value: v, label: v.replaceAll('_', ' ') }))} />
      {(directory.canAssign || canHandoff) && <Choices label={directory.canAssign ? 'Assigned to' : 'Hand off to'} value={assignedTo} onChange={setAssignedTo}
        options={[...(directory.canAssign ? [{ value: '', label: 'Unassigned' }] : []), ...assignees.map(p => ({ value: String(p.id), label: p.name }))]} />}
      {item.kind !== 'onboarding' && <DateTime label={item.kind === 'support' ? 'Response deadline' : 'Scheduled time'} day={scheduledDay} time={scheduledTime} onDay={setScheduledDay} onTime={setScheduledTime} />}
      <Field label={item.kind === 'support' ? 'Internal notes' : 'Notes or blockers'} value={notes} onChange={setNotes} multiline />
      {item.kind === 'visits' && <>
        <Field label="Visit outcome" value={outcome} onChange={setOutcome} multiline />
        {!item.followUpTaskId && <>
          <Field label="Follow-up task (optional)" value={task} onChange={setTask} />
          {!!task.trim() && <DateTime label="Follow-up due" day={day} time={time} onDay={setDay} onTime={setTime} />}
        </>}
      </>}
      <View style={s.actions}><Action title="Save update" disabled={save.isPending || onlineSave.isPending} onPress={commit} /><Action title="Cancel" secondary onPress={() => setEditing(false)} /></View>
    </>}
    {save.isPaused && <Text style={s.meta}>Waiting to sync</Text>}
    {save.isError && <Text style={s.error}>Sync failed. Open Sync queue to retry.</Text>}
    {item.kind === 'support' && <>
      {!!item.events.length && <Action title={history ? 'Hide ticket history' : 'Ticket history'} secondary onPress={() => setHistory(v => !v)} />}
      {history && item.events.map(e => <Text key={e.id} style={s.meta}>{formatDateTime(e.createdAt)} · {e.status.replace(/_/g, ' ')}{e.notes ? ' · ' + e.notes : ''}</Text>)}
      {item.files.map(f => <Action key={f.id} title={f.name} secondary onPress={() => void openFile(f)} />)}
      <FileChooser file={photo} onPick={setPhoto} imagesOnly />
      {photo && <Action title="Upload ticket photo" disabled={upload.isPending} onPress={() => upload.mutate(photo)} />}
    </>}
  </View>
}

function CollectionCard({ payment }: { payment: OverdueInstalment }) {
  const [outcome, setOutcome] = useState('')
  const [day, setDay] = useState('')
  const [time, setTime] = useState('09:00')
  const client = useQueryClient()
  const save = useMutation({
    mutationFn: () => api.post('/operations/collections/' + payment.id + '/follow-ups', { outcome, dueAt: day ? asIso(day, time) : undefined }),
    onSuccess: () => { setOutcome(''); setDay(''); void client.invalidateQueries({ queryKey: ['operations'] }); void client.invalidateQueries({ queryKey: ['tasks'] }) },
    onError: showError, retry: false,
  })
  return <View style={s.panel}>
    <Text style={s.heading}>{payment.school.name} · {formatCurrency(payment.amount)}</Text>
    <Text style={s.meta}>{payment.daysOverdue} days overdue · Due {formatDate(payment.dueDate)} · {payment.school.assignedTo?.name ?? 'Unassigned'}</Text>
    {payment.followUps.map(f => <Text key={f.id} style={s.meta}>{formatDate(f.createdAt)} · {f.outcome}{f.dueAt && ' · Next follow-up ' + formatDate(f.dueAt)}</Text>)}
    <Field label="Follow-up outcome" value={outcome} onChange={setOutcome} multiline />
    <DateTime label="Next task due (optional)" day={day} time={time} onDay={setDay} onTime={setTime} />
    <Action title="Log follow-up" disabled={!outcome.trim() || save.isPending} onPress={() => save.mutate()} />
  </View>
}

export default function OperationsScreen() {
  const params = useLocalSearchParams<{ school?: string; module?: string; record?: string; chat?: string }>()
  const router = useRouter()
  const role = useAuthStore(s => s.user?.role)
  const modules = role === 'FINANCE' ? ['collections'] as const : role === 'SUPPORT' ? ['support'] as const : SCHOOL_MODULES
  const selectedModule = modules.find(m => m === params.module) ?? modules[0]
  const [module, setModule] = useState<SchoolModule>(selectedModule)
  const [school, setSchool] = useState(params.school ?? '')
  const [creating, setCreating] = useState(false)
  const [todayOnly, setTodayOnly] = useState(true)
  const [supportFilter, setSupportFilter] = useState<SupportQueueFilter>('all')
  useEffect(() => {
    setSchool(params.school ?? '')
    setModule(selectedModule)
    setCreating(false)
  }, [params.school, selectedModule])
  const directory = useQuery<OperationsIndex>({ queryKey: ['operations', 'index'], queryFn: () => api.get('/operations/index').then(r => r.data) })
  const endpoint = module === 'collections' ? '/collections' : module === 'documents' ? '/files' : '/work/' + module
  const list = useQuery<(SchoolWork | SchoolFile | OverdueInstalment)[]>({
    queryKey: ['operations', module, school],
    refetchInterval: module === 'support' ? 30_000 : false,
    queryFn: () => api.get('/operations' + endpoint, { params: { schoolId: school || undefined } }).then(r => r.data),
  })
  const today = localDateInput(new Date())
  const visible = (list.data ?? []).filter(row => {
    if (params.record) return String(row.id) === params.record
    if ('kind' in row && row.kind === 'support') return matchesSupportQueue(row, supportFilter)
    if (!todayOnly || !('daysOverdue' in row)) return true
    const nextFollowUp = row.followUps[0]?.dueAt
    return !nextFollowUp || localDateInput(nextFollowUp) <= today
  })
  return <ScrollView style={s.screen} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    <Choices label="Modules" value={module} onChange={v => { setModule(v as SchoolModule); setCreating(false); router.setParams({ module: v, record: '', chat: '' }) }}
      options={modules.map(m => ({ value: m, label: SCHOOL_MODULE_LABELS[m] }))} />
    {directory.data && <Choices label="Filter by school" value={school} onChange={value => { setSchool(value); router.setParams({ school: value, record: '', chat: '' }) }}
      options={[{ value: '', label: 'All schools' }, ...directory.data.schools.map(x => ({ value: String(x.id), label: x.name }))]} />}
    {module === 'support' && directory.data?.canAssign && !params.record && <Choices label="Support queue" value={supportFilter}
      options={Object.entries(SUPPORT_QUEUE_FILTERS).map(([value, label]) => ({ value, label }))} onChange={value => setSupportFilter(value as SupportQueueFilter)} />}
    {module === 'collections' && <Choices label="Collections view" value={todayOnly ? 'today' : 'all'}
      onChange={value => setTodayOnly(value === 'today')} options={[{ value: 'today', label: 'Follow up today' }, { value: 'all', label: 'All overdue' }]} />}
    {!!params.record && <Action title="Show all records" secondary onPress={() => router.setParams({ record: '', chat: '' })} />}
    {role !== 'SUPPORT' && module !== 'collections' && directory.data && <>
      <Action title={creating ? 'Hide form' : 'Add ' + ({ visits: 'visit', onboarding: 'checklist', support: 'ticket', documents: 'document' }[module])} onPress={() => setCreating(v => !v)} />
      {creating && <CreateForm key={module + school} module={module} directory={directory.data} selectedSchool={school} />}
    </>}
    {(directory.isLoading || list.isLoading) && <ActivityIndicator color={C.primary} />}
    {(directory.isError || list.isError) && <Action title="Retry loading" secondary onPress={() => { void directory.refetch(); void list.refetch() }} />}
    {list.isSuccess && !visible.length && <Text style={s.meta}>{module === 'collections' ? 'No overdue instalments in this view.' : 'No records in this view.'}</Text>}
    {directory.data && visible.map(row => 'daysOverdue' in row ? <CollectionCard key={row.id} payment={row} /> : 'mimeType' in row
      ? <View key={row.id} style={s.panel}><Text style={s.heading}>{row.name}</Text><Text style={s.meta}>{row.school.name} · {row.category}</Text><Action title="Open document" secondary onPress={() => void openFile(row)} /></View>
      : <WorkCard key={row.id} item={row} directory={directory.data!} openChat={params.record === String(row.id) && params.chat === '1'}
        dismissChat={() => { if (params.chat) router.setParams({ chat: '' }) }} />)}
  </ScrollView>
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  panel: { backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, borderRadius: 12, padding: 14, gap: 10 },
  heading: { fontSize: 16, fontWeight: '700', color: C.text },
  label: { fontSize: 13, color: C.text, fontWeight: '600' },
  meta: { fontSize: 13, color: C.textSecondary },
  link: { color: C.primary, fontWeight: '600' },
  error: { color: C.error },
  field: { gap: 6 },
  input: { backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, borderRadius: 8, padding: 10, color: C.text },
  choices: { gap: 7, paddingVertical: 3 },
  chip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  selected: { backgroundColor: C.primary, borderColor: C.primary },
  selectedText: { fontSize: 13, color: '#fff', fontWeight: '600' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { alignSelf: 'flex-start', borderRadius: 8, backgroundColor: C.primary, paddingHorizontal: 13, paddingVertical: 9 },
  secondary: { backgroundColor: C.surface, borderColor: C.border, borderWidth: 1 },
  actionText: { color: '#fff', fontWeight: '600', fontSize: 13 },
})
