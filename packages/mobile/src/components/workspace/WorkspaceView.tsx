import { useState } from 'react'
import { Alert, Modal, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native'
import type { AxiosInstance } from 'axios'
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { initialWorkspaceFields, SCHOOL_FILE_MAX_BYTES, workspacePayload, type SchoolFileUpload, type WorkspaceAction, type WorkspaceField, type WorkspacePage } from '@lms/shared'
import { TicketChatButton } from '@/components/support/TicketChatButton'
import { uuidv4 } from '@/lib/uuid'
import { C } from '@/lib/colors'
import { DatePickerField } from '@/components/shared/DatePickerField'
import { TimePickerField } from '@/components/shared/TimePickerField'

type FieldValue = string | SchoolFileUpload

export function workspaceError(error: unknown) {
  const e = error as { response?: { data?: { message?: string } }; message?: string }
  return e?.response?.data?.message ?? e?.message ?? 'Please try again'
}

export function WorkspaceButton({ title, onPress, secondary, disabled }: {
  title: string; onPress: () => void; secondary?: boolean; disabled?: boolean
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={[s.button, secondary && s.secondary, disabled && s.disabled]}>
    <Text style={[s.buttonText, secondary && s.secondaryText]}>{title}</Text>
  </Pressable>
}

export function WorkspaceChoice({ value, label, options, onChange, disabled }: {
  value: string; label: string; options: { value: string; label: string }[]; onChange: (v: string) => void; disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  return <View style={s.field}>
    <Text style={s.label}>{label}</Text>
    <WorkspaceButton secondary disabled={disabled} title={options.find(o => o.value === value)?.label ?? 'Choose an option'}
      onPress={() => { setSearch(''); setOpen(true) }} />
    {open && <Modal animationType="slide" onRequestClose={() => setOpen(false)}>
      <View style={s.sheet}>
        <Text style={s.title}>{label}</Text>
        {options.length > 8 && <TextInput accessibilityLabel="Search options" placeholder="Search options" style={s.input} value={search} onChangeText={setSearch} />}
        <ScrollView keyboardShouldPersistTaps="handled">
          {options.filter(o => o.label.toLowerCase().includes(search.trim().toLowerCase())).map(o =>
            <WorkspaceButton key={o.value} secondary={o.value !== value} title={o.label} onPress={() => { onChange(o.value); setOpen(false) }} />)}
        </ScrollView>
        <WorkspaceButton secondary title="Close" onPress={() => setOpen(false)} />
      </View>
    </Modal>}
  </View>
}

async function pickFile(camera: boolean, imagesOnly?: boolean): Promise<SchoolFileUpload | undefined> {
  if (camera) {
    if (!(await ImagePicker.requestCameraPermissionsAsync()).granted) throw new Error('Allow camera access in your device settings')
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.45 })
    if (result.canceled) return
    const file = new File(result.assets[0].uri)
    if (file.size > SCHOOL_FILE_MAX_BYTES) throw new Error('The photo must be 5 MB or smaller')
    return { name: 'Capture-' + Date.now() + '.jpg', mimeType: 'image/jpeg', base64: await file.base64() }
  }
  const result = await DocumentPicker.getDocumentAsync({ type: imagesOnly ? ['image/jpeg', 'image/png'] : ['application/pdf', 'image/jpeg', 'image/png'], copyToCacheDirectory: true })
  if (result.canceled) return
  const asset = result.assets[0]
  const file = new File(asset.uri)
  if (file.size > SCHOOL_FILE_MAX_BYTES) throw new Error('The file must be 5 MB or smaller')
  const mimeType = asset.mimeType ?? (/\.pdf$/i.test(asset.name) ? 'application/pdf' : /\.png$/i.test(asset.name) ? 'image/png' : 'image/jpeg')
  return { name: asset.name, mimeType, base64: await file.base64() }
}

function FormField({ field, value, set, disabled, onFileBusy }: {
  field: WorkspaceField; value: FieldValue; set: (value: FieldValue) => void; disabled: boolean; onFileBusy: (busy: boolean) => void
}) {
  const label = field.label + (field.required ? ' *' : '')
  const text = typeof value === 'string' ? value : ''
  const [picking, setPicking] = useState(false)
  async function attach(camera: boolean) {
    setPicking(true)
    onFileBusy(true)
    try {
      const file = await pickFile(camera, field.imagesOnly)
      if (file) set(file)
    } catch (error) { Alert.alert('Could not attach file', workspaceError(error)) }
    finally { setPicking(false); onFileBusy(false) }
  }
  if (field.kind === 'select') {
    return <WorkspaceChoice label={label} value={text} options={field.options ?? []} onChange={set} disabled={disabled} />
  }
  const [date, time = '09:00'] = text.split('T')
  return <View style={s.field}>
    <Text style={s.label}>{label}</Text>
    {field.kind === 'date' || field.kind === 'datetime' ? <>
      <DatePickerField value={date} disabled={disabled} accessibilityLabel={label}
        onChange={v => set(field.kind === 'datetime' ? v + 'T' + time : v)} />
      {field.kind === 'datetime' && date && <TimePickerField value={time} onChange={v => set(date + 'T' + v)} />}
      {date && !field.required && <WorkspaceButton title="Clear date" secondary disabled={disabled} onPress={() => set('')} />}
    </> : field.kind === 'file' ? <>
      {typeof value !== 'string' && <Text style={s.body}>{value.name}</Text>}
      <View style={s.actions}>
        <WorkspaceButton title="Choose file" secondary disabled={disabled || picking} onPress={() => void attach(false)} />
        <WorkspaceButton title="Take photo" secondary disabled={disabled || picking} onPress={() => void attach(true)} />
      </View>
    </> : <TextInput accessibilityLabel={label} style={[s.input, field.kind === 'textarea' && s.multiline]} value={text} onChangeText={set}
      keyboardType={field.kind === 'number' ? 'decimal-pad' : 'default'} editable={!disabled} multiline={field.kind === 'textarea'} maxLength={field.kind === 'textarea' ? 4000 : 200} />}
  </View>
}

export function WorkspaceView({ page, client, onChange, record, onLink, openTicket, onChatDismiss }: {
  page: WorkspacePage; client: AxiosInstance; onChange: () => void; record?: string; onLink?: (path: string) => void
  openTicket?: string; onChatDismiss?: () => void
}) {
  const [active, setActive] = useState<WorkspaceAction>()
  const [fields, setFields] = useState<Record<string, FieldValue>>({})
  const [busy, setBusy] = useState(false)
  const [fileBusy, setFileBusy] = useState(false)
  const [requestId, setRequestId] = useState('')
  const [error, setError] = useState('')
  const [secret, setSecret] = useState<{ code: string; expiresAt?: string }>()
  const hasRecord = !!record && page.sections.some(section => section.cards.some(card => card.id === record))

  async function save() {
    if (!active || busy || fileBusy) return
    setBusy(true)
    setError('')
    try {
      const { data } = await client.request<{ secret?: string; expiresAt?: string; message?: string }>({
        url: active.path, method: active.method ?? 'POST', data: { ...workspacePayload(active, fields), ...(requestId ? { requestId } : {}) }, timeout: 60_000,
      })
      setActive(undefined)
      if (data.secret) setSecret({ code: data.secret, expiresAt: data.expiresAt })
      onChange()
    } catch (e) { setError(workspaceError(e)) }
    finally { setBusy(false) }
  }

  async function download(path: string, name: string) {
    let file: File | undefined
    try {
      if (!(await Sharing.isAvailableAsync())) throw new Error('File sharing is unavailable on this device')
      const response = await client.get<ArrayBuffer>(path, { responseType: 'arraybuffer', timeout: 60_000 })
      file = new File(Paths.cache, Date.now() + '-' + name.replace(/[^\w.-]/g, '_'))
      file.write(new Uint8Array(response.data))
      const contentType = response.headers['content-type']
      await Sharing.shareAsync(file.uri, { dialogTitle: name, mimeType: typeof contentType === 'string' ? contentType.split(';')[0] : undefined })
    } catch (e) { Alert.alert('Could not open the file', workspaceError(e)) }
    finally { if (file?.exists) file.delete() }
  }

  return <View style={s.content}>
    <Text style={s.title}>{page.title}</Text>
    <Text style={s.body}>{page.description}</Text>
    {record && !hasRecord && <Text style={s.body}>This record is unavailable in the current view.</Text>}
    {page.sections.map(section => {
      const cards = hasRecord ? section.cards.filter(card => card.id === record) : section.cards
      if (hasRecord && !cards.length) return null
      return <View key={section.title} style={s.content}>
        <Text style={s.heading}>{section.title}</Text>
        {!cards.length && <Text style={s.body}>No records to show.</Text>}
        {cards.map(card => <View key={card.id} style={s.card}>
          <Text style={s.heading}>{card.title}</Text>
          {card.badge && <Text style={s.badge}>{card.badge}</Text>}
          {card.subtitle && <Text style={s.body}>{card.subtitle}</Text>}
          {card.lines?.map((line, index) => <Text key={index} style={s.body}>{line}</Text>)}
          <View style={s.actions}>
            {card.ticketChatPath && <TicketChatButton client={client} path={card.ticketChatPath} title={card.title} draftOwner={page.draftOwner}
              openFromLink={!!openTicket && card.id === 'ticket-' + openTicket} onDismiss={onChatDismiss} />}
            {card.actions?.map(action => <WorkspaceButton key={action.label} title={action.label} onPress={() => {
              setError(''); setFields(initialWorkspaceFields(action)); setActive(action)
              setRequestId(action.requestId ? uuidv4() : '')
            }} />)}
            {card.links?.map(link => <WorkspaceButton key={link.path} title={link.label} secondary onPress={() => {
              if (link.downloadName) void download(link.path, link.downloadName)
              else onLink?.(link.path)
            }} />)}
          </View>
        </View>)}
      </View>
    })}
    {active && <Modal animationType="slide" onRequestClose={() => { if (!busy && !fileBusy) setActive(undefined) }}>
      <ScrollView contentContainerStyle={s.sheet} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>{active.label}</Text>
        {active.confirm && <Text style={s.body}>{active.confirm}</Text>}
        {active.fields?.map(field => <FormField key={field.name} field={field} disabled={busy || fileBusy} onFileBusy={setFileBusy} value={fields[field.name] ?? ''}
          set={value => setFields(current => ({ ...current, [field.name]: value }))} />)}
        {!!error && <Text accessibilityLiveRegion="polite" style={{ color: C.error }}>{error}</Text>}
        <View style={s.actions}>
          <WorkspaceButton title="Cancel" secondary disabled={busy || fileBusy} onPress={() => setActive(undefined)} />
          <WorkspaceButton title={busy ? 'Saving…' : active.label} disabled={busy || fileBusy} onPress={() => void save()} />
        </View>
      </ScrollView>
    </Modal>}
    {secret && <Modal animationType="slide" onRequestClose={() => setSecret(undefined)}>
      <View style={s.sheet}>
        <Text style={s.title}>School access code</Text>
        <Text style={s.body}>Share this code with the selected school contact. It is shown only once.</Text>
        <Text selectable style={s.heading}>{secret.code}</Text>
        {secret.expiresAt && <Text style={s.body}>Expires {new Date(secret.expiresAt).toLocaleDateString()}</Text>}
        <WorkspaceButton title="Share code" onPress={() => void Share.share({ message: secret.code }).catch(e => Alert.alert('Could not share', workspaceError(e)))} />
        <WorkspaceButton title="Done" secondary onPress={() => setSecret(undefined)} />
      </View>
    </Modal>}
  </View>
}

const s = StyleSheet.create({
  content: { gap: 12 }, sheet: { flexGrow: 1, padding: 24, paddingTop: 54, gap: 12, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', color: C.text }, heading: { fontSize: 16, fontWeight: '700', color: C.text },
  body: { fontSize: 14, color: C.textSecondary }, badge: { color: C.primary, fontWeight: '700' },
  card: { padding: 14, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: '#fff', gap: 6 },
  field: { gap: 6 }, label: { fontWeight: '600', color: C.text }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 10, color: C.text }, multiline: { minHeight: 80, textAlignVertical: 'top' },
  button: { borderWidth: 1, borderColor: C.primary, backgroundColor: C.primary, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, marginVertical: 2 },
  secondary: { backgroundColor: '#fff', borderColor: C.border }, disabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '600' }, secondaryText: { color: C.primary },
})
