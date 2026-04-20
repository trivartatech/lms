import { useState, useCallback, useRef, useEffect } from 'react'
import {
  View,
  Text,
  FlatList,
  ScrollView,
  Modal,
  TextInput,
  Pressable,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Linking,
  ActivityIndicator,
  Animated,
  PanResponder,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import * as Sharing from 'expo-sharing'
import * as FileSystem from 'expo-file-system'
import * as DocumentPicker from 'expo-document-picker'
import { C } from '@/lib/colors'
import { formatDate, todayISO } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { SearchBar } from '@/components/shared/SearchBar'
import { ContactActions } from '@/components/shared/ContactActions'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import type { Lead, PaginatedLeads, PipelineStage, UserSummary, School } from '@lms/shared'

const PIPELINE_STAGES: PipelineStage[] = [
  'NEW', 'QUALIFIED', 'DEMO', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST',
]

const STAGE_COLORS: Record<PipelineStage, { header: string; headerText: string; card: string }> = {
  NEW:          { header: '#475569', headerText: '#fff', card: '#f8fafc' },
  QUALIFIED:    { header: C.primary, headerText: '#fff', card: C.primaryLight },
  DEMO:         { header: C.purple, headerText: '#fff', card: C.purpleLight },
  PROPOSAL:     { header: C.warning, headerText: '#fff', card: C.warningLight },
  NEGOTIATION:  { header: C.orange, headerText: '#fff', card: C.orangeLight },
  CLOSED_WON:   { header: C.success, headerText: '#fff', card: C.successLight },
  CLOSED_LOST:  { header: C.error, headerText: '#fff', card: C.errorLight },
}

const STAGE_LABELS: Record<PipelineStage, string> = {
  NEW: 'New', QUALIFIED: 'Qualified', DEMO: 'Demo', PROPOSAL: 'Proposal',
  NEGOTIATION: 'Negotiation', CLOSED_WON: 'Closed Won', CLOSED_LOST: 'Closed Lost',
}

// ─── CSV parsing helpers (mirror web) ───────────────────────────────────────

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/^\ufeff/, '').trim().split(/\r?\n/)
  if (lines.length === 0) return []
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''))
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']))
  })
}

function normalizeLeadRow(row: Record<string, string>) {
  const get = (keys: string[]) => {
    for (const k of keys) {
      const found = Object.keys(row).find((rk) => rk.toLowerCase() === k.toLowerCase())
      if (found) return row[found]
    }
    return ''
  }
  return {
    schoolName: get(['School Name', 'schoolName']),
    contactPerson: get(['Contact Person', 'contactPerson']),
    phone: get(['Phone', 'phone']),
    email: get(['Email', 'email']),
    location: get(['Location', 'location']),
    notes: get(['Notes', 'notes']),
  }
}

// ─── CSV Import Modal ───────────────────────────────────────────────────────

interface ImportModalProps {
  visible: boolean
  onClose: () => void
}

function ImportModal({ visible, onClose }: ImportModalProps) {
  const queryClient = useQueryClient()
  const [rows, setRows] = useState<ReturnType<typeof normalizeLeadRow>[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('')

  const importMutation = useMutation({
    mutationFn: (payload: object[]) => api.post('/leads/import', payload).then((r) => r.data),
    onSuccess: (data: { imported: number }) => {
      setStatus(`Successfully imported ${data.imported} lead${data.imported === 1 ? '' : 's'}.`)
      queryClient.invalidateQueries({ queryKey: ['leads'] })
    },
    onError: () => setStatus('Import failed. Please check your file and try again.'),
  })

  async function pickFile() {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/csv', 'public.comma-separated-values-text', '*/*'],
        copyToCacheDirectory: true,
      })
      if (res.canceled || !res.assets?.[0]) return
      const asset = res.assets[0]
      setFileName(asset.name)
      setStatus('')
      const text = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      })
      const parsed = parseCSV(text)
      setRows(parsed.map(normalizeLeadRow))
    } catch (e) {
      Alert.alert('Error', 'Could not read CSV file.')
    }
  }

  function reset() {
    setRows([])
    setFileName(null)
    setStatus('')
  }

  function handleClose() {
    reset()
    onClose()
  }

  const validRows = rows.filter((r) => r.schoolName && r.phone)
  const invalidCount = rows.length - validRows.length

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={fm.container}>
        <View style={fm.header}>
          <Text style={fm.title}>Import Leads from CSV</Text>
          <Pressable onPress={handleClose} hitSlop={8}>
            <Text style={fm.cancel}>Close</Text>
          </Pressable>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={fm.body} keyboardShouldPersistTaps="handled">
          <Text style={{ fontSize: 13, color: C.textSecondary, marginBottom: 12 }}>
            Pick a CSV with headers: School Name, Contact Person, Phone, Email, Location, Notes.
            Required columns: School Name, Phone.
          </Text>

          <Pressable
            style={[fm.submit, { backgroundColor: C.primary, marginTop: 4 }]}
            onPress={pickFile}
            disabled={importMutation.isPending}
          >
            <Text style={fm.submitText}>{fileName ? `Replace file (${fileName})` : 'Pick CSV file'}</Text>
          </Pressable>

          {rows.length > 0 && (
            <View style={{ marginTop: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 6 }}>
                Preview: {validRows.length} valid{invalidCount > 0 ? ` · ${invalidCount} skipped (missing school or phone)` : ''}
              </Text>
              <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 8, backgroundColor: C.surface }}>
                {rows.slice(0, 20).map((r, i) => {
                  const valid = r.schoolName && r.phone
                  return (
                    <View
                      key={i}
                      style={{
                        padding: 10,
                        borderBottomWidth: i < Math.min(rows.length, 20) - 1 ? 1 : 0,
                        borderBottomColor: C.border,
                        backgroundColor: valid ? 'transparent' : C.errorLight,
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: C.text }}>
                        {r.schoolName || <Text style={{ color: C.error }}>— missing —</Text>}
                      </Text>
                      <Text style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }}>
                        {r.contactPerson || '—'} · {r.phone || <Text style={{ color: C.error }}>missing phone</Text>}
                      </Text>
                      {(r.email || r.location) ? (
                        <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                          {[r.email, r.location].filter(Boolean).join(' · ')}
                        </Text>
                      ) : null}
                    </View>
                  )
                })}
                {rows.length > 20 && (
                  <Text style={{ padding: 8, fontSize: 12, color: C.textMuted, textAlign: 'center' }}>
                    …and {rows.length - 20} more
                  </Text>
                )}
              </View>
            </View>
          )}

          {status !== '' && (
            <Text style={{ marginTop: 14, fontSize: 13, color: status.startsWith('Successfully') ? C.success : C.error, fontWeight: '600' }}>
              {status}
            </Text>
          )}

          {validRows.length > 0 && !status.startsWith('Successfully') && (
            <Pressable
              style={[fm.submit, importMutation.isPending && fm.submitDisabled]}
              onPress={() => importMutation.mutate(validRows)}
              disabled={importMutation.isPending}
            >
              {importMutation.isPending
                ? <ActivityIndicator color="#fff" />
                : <Text style={fm.submitText}>Import {validRows.length} lead{validRows.length === 1 ? '' : 's'}</Text>}
            </Pressable>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

// ─── Lead Form Modal ────────────────────────────────────────────────────────

interface LeadFormModalProps {
  visible: boolean
  onClose: () => void
  onSaved: () => void
  lead?: Lead
}

function LeadFormModal({ visible, onClose, onSaved, lead }: LeadFormModalProps) {
  const queryClient = useQueryClient()
  const [schoolName, setSchoolName] = useState(lead?.schoolName ?? '')
  const [contactPerson, setContactPerson] = useState(lead?.contactPerson ?? '')
  const [phone, setPhone] = useState(lead?.phone ?? '')
  const [email, setEmail] = useState(lead?.email ?? '')
  const [location, setLocation] = useState(lead?.location ?? '')
  const [totalStudents, setTotalStudents] = useState(lead?.totalStudents?.toString() ?? '')
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>(lead?.pipelineStage ?? 'NEW')
  const [assignedToId, setAssignedToId] = useState<number | null>(lead?.assignedToId ?? null)
  const [notes, setNotes] = useState(lead?.notes ?? '')
  const [referredBy, setReferredBy] = useState<string>(() => {
    if (lead?.referredBySchoolId) return `school:${lead.referredBySchoolId}`
    if (lead?.referredByLeadId) return `lead:${lead.referredByLeadId}`
    return ''
  })
  const [showStagePicker, setShowStagePicker] = useState(false)
  const [showUserPicker, setShowUserPicker] = useState(false)
  const [showReferrerPicker, setShowReferrerPicker] = useState(false)

  const { data: users = [] } = useQuery<UserSummary[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
    enabled: visible,
  })

  const { data: schoolsList } = useQuery<{ data: School[] }>({
    queryKey: ['schools', 'list'],
    queryFn: () => api.get('/schools', { params: { limit: 200 } }).then((r) => r.data),
    enabled: visible,
  })

  const { data: pipelineNew } = useQuery<PaginatedLeads>({
    queryKey: ['leads', 'pipeline-new'],
    queryFn: () => api.get('/leads', { params: { limit: 200, status: 'NEW' } }).then((r) => r.data),
    enabled: visible,
  })

  const { data: pipelineInProgress } = useQuery<PaginatedLeads>({
    queryKey: ['leads', 'pipeline-inprogress'],
    queryFn: () => api.get('/leads', { params: { limit: 200, status: 'IN_PROGRESS' } }).then((r) => r.data),
    enabled: visible,
  })

  const referrerSchools = schoolsList?.data ?? []
  const referrerLeads = [
    ...(pipelineNew?.data ?? []),
    ...(pipelineInProgress?.data ?? []),
  ].filter((l) => !lead || l.id !== lead.id)

  const mutation = useMutation({
    mutationFn: (dto: Record<string, unknown>) =>
      lead
        ? api.put(`/leads/${lead.id}`, dto).then((r) => r.data)
        : api.post('/leads', dto).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      onSaved()
      onClose()
    },
    onError: () => Alert.alert('Error', 'Failed to save lead. Please try again.'),
  })

  useEffect(() => {
    if (visible && lead) {
      setSchoolName(lead.schoolName)
      setContactPerson(lead.contactPerson)
      setPhone(lead.phone)
      setEmail(lead.email ?? '')
      setLocation(lead.location ?? '')
      setTotalStudents(lead.totalStudents?.toString() ?? '')
      setPipelineStage(lead.pipelineStage)
      setAssignedToId(lead.assignedToId ?? null)
      setNotes(lead.notes ?? '')
      setReferredBy(
        lead.referredBySchoolId
          ? `school:${lead.referredBySchoolId}`
          : lead.referredByLeadId
          ? `lead:${lead.referredByLeadId}`
          : ''
      )
    } else if (visible && !lead) {
      setSchoolName(''); setContactPerson(''); setPhone(''); setEmail('')
      setLocation(''); setTotalStudents(''); setPipelineStage('NEW')
      setAssignedToId(null); setNotes(''); setReferredBy('')
    }
  }, [visible, lead])

  function handleSubmit() {
    if (!schoolName.trim()) return Alert.alert('Validation', 'School name is required.')
    if (!contactPerson.trim()) return Alert.alert('Validation', 'Contact person is required.')
    if (!phone.trim()) return Alert.alert('Validation', 'Phone is required.')
    const dto: Record<string, unknown> = {
      schoolName: schoolName.trim(),
      contactPerson: contactPerson.trim(),
      phone: phone.trim(),
      pipelineStage,
    }
    if (email.trim()) dto.email = email.trim()
    if (location.trim()) dto.location = location.trim()
    if (totalStudents.trim()) dto.totalStudents = parseInt(totalStudents, 10)
    if (assignedToId) dto.assignedToId = assignedToId
    if (notes.trim()) dto.notes = notes.trim()
    if (referredBy.startsWith('school:')) {
      dto.referredBySchoolId = parseInt(referredBy.split(':')[1], 10)
      dto.referredByLeadId = null
    } else if (referredBy.startsWith('lead:')) {
      dto.referredByLeadId = parseInt(referredBy.split(':')[1], 10)
      dto.referredBySchoolId = null
    } else if (lead && (lead.referredBySchoolId || lead.referredByLeadId)) {
      dto.referredBySchoolId = null
      dto.referredByLeadId = null
    }
    mutation.mutate(dto)
  }

  const assignedUser = users.find((u) => u.id === assignedToId)

  const referrerLabel = (() => {
    if (referredBy.startsWith('school:')) {
      const id = parseInt(referredBy.split(':')[1], 10)
      const s = referrerSchools.find((x) => x.id === id)
      return s ? `${s.name} (Client)` : 'Selected school'
    }
    if (referredBy.startsWith('lead:')) {
      const id = parseInt(referredBy.split(':')[1], 10)
      const l = referrerLeads.find((x) => x.id === id)
      return l ? `${l.schoolName} (Pipeline)` : 'Selected lead'
    }
    return 'None'
  })()

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={fm.container}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={fm.header}>
            <Text style={fm.title}>{lead ? 'Edit Lead' : 'New Lead'}</Text>
            <Pressable onPress={onClose} hitSlop={8}><Text style={fm.cancel}>Cancel</Text></Pressable>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={fm.body} keyboardShouldPersistTaps="handled">
            <Text style={fm.label}>School Name *</Text>
            <TextInput style={fm.input} value={schoolName} onChangeText={setSchoolName} placeholder="Enter school name" placeholderTextColor={C.textMuted} />

            <Text style={fm.label}>Contact Person *</Text>
            <TextInput style={fm.input} value={contactPerson} onChangeText={setContactPerson} placeholder="Enter contact person" placeholderTextColor={C.textMuted} />

            <Text style={fm.label}>Phone *</Text>
            <TextInput style={fm.input} value={phone} onChangeText={setPhone} placeholder="Enter phone" placeholderTextColor={C.textMuted} keyboardType="phone-pad" />

            <Text style={fm.label}>Email</Text>
            <TextInput style={fm.input} value={email} onChangeText={setEmail} placeholder="Enter email" placeholderTextColor={C.textMuted} keyboardType="email-address" autoCapitalize="none" />

            <Text style={fm.label}>Location</Text>
            <TextInput style={fm.input} value={location} onChangeText={setLocation} placeholder="City / District" placeholderTextColor={C.textMuted} />

            <Text style={fm.label}>Total Students</Text>
            <TextInput style={fm.input} value={totalStudents} onChangeText={setTotalStudents} placeholder="e.g. 500" placeholderTextColor={C.textMuted} keyboardType="numeric" />

            <Text style={fm.label}>Pipeline Stage</Text>
            <Pressable style={fm.picker} onPress={() => setShowStagePicker(true)}>
              <Text style={fm.pickerText}>{STAGE_LABELS[pipelineStage]}</Text>
              <Text style={fm.pickerArrow}>▼</Text>
            </Pressable>

            <Text style={fm.label}>Assign To</Text>
            <Pressable style={fm.picker} onPress={() => setShowUserPicker(true)}>
              <Text style={fm.pickerText}>{assignedUser ? assignedUser.name : 'Unassigned'}</Text>
              <Text style={fm.pickerArrow}>▼</Text>
            </Pressable>

            <Text style={fm.label}>Referred By</Text>
            <Pressable style={fm.picker} onPress={() => setShowReferrerPicker(true)}>
              <Text style={fm.pickerText}>{referrerLabel}</Text>
              <Text style={fm.pickerArrow}>▼</Text>
            </Pressable>

            <Text style={fm.label}>Notes</Text>
            <TextInput
              style={[fm.input, fm.textarea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add notes..."
              placeholderTextColor={C.textMuted}
              multiline
              numberOfLines={4}
            />

            <Pressable
              style={[fm.submit, mutation.isPending && fm.submitDisabled]}
              onPress={handleSubmit}
              disabled={mutation.isPending}
            >
              {mutation.isPending
                ? <ActivityIndicator color="#fff" />
                : <Text style={fm.submitText}>{lead ? 'Save Changes' : 'Create Lead'}</Text>
              }
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Stage Picker */}
        <Modal visible={showStagePicker} transparent animationType="fade" onRequestClose={() => setShowStagePicker(false)}>
          <Pressable style={fm.overlay} onPress={() => setShowStagePicker(false)}>
            <View style={fm.pickerModal}>
              <Text style={fm.pickerModalTitle}>Select Stage</Text>
              {PIPELINE_STAGES.map((s) => (
                <Pressable
                  key={s}
                  style={[fm.pickerOption, pipelineStage === s && fm.pickerOptionActive]}
                  onPress={() => { setPipelineStage(s); setShowStagePicker(false) }}
                >
                  <Text style={[fm.pickerOptionText, pipelineStage === s && fm.pickerOptionActiveText]}>{STAGE_LABELS[s]}</Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Modal>

        {/* User Picker */}
        <Modal visible={showUserPicker} transparent animationType="fade" onRequestClose={() => setShowUserPicker(false)}>
          <Pressable style={fm.overlay} onPress={() => setShowUserPicker(false)}>
            <View style={fm.pickerModal}>
              <Text style={fm.pickerModalTitle}>Assign To</Text>
              <Pressable
                style={[fm.pickerOption, assignedToId === null && fm.pickerOptionActive]}
                onPress={() => { setAssignedToId(null); setShowUserPicker(false) }}
              >
                <Text style={[fm.pickerOptionText, assignedToId === null && fm.pickerOptionActiveText]}>Unassigned</Text>
              </Pressable>
              {users.map((u) => (
                <Pressable
                  key={u.id}
                  style={[fm.pickerOption, assignedToId === u.id && fm.pickerOptionActive]}
                  onPress={() => { setAssignedToId(u.id); setShowUserPicker(false) }}
                >
                  <Text style={[fm.pickerOptionText, assignedToId === u.id && fm.pickerOptionActiveText]}>{u.name}</Text>
                  <Text style={fm.pickerOptionSub}>{u.role}</Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Modal>

        {/* Referrer Picker */}
        <Modal visible={showReferrerPicker} transparent animationType="fade" onRequestClose={() => setShowReferrerPicker(false)}>
          <Pressable style={fm.overlay} onPress={() => setShowReferrerPicker(false)}>
            <View style={[fm.pickerModal, { maxHeight: '80%' }]}>
              <Text style={fm.pickerModalTitle}>Referred By</Text>
              <ScrollView keyboardShouldPersistTaps="handled">
                <Pressable
                  style={[fm.pickerOption, referredBy === '' && fm.pickerOptionActive]}
                  onPress={() => { setReferredBy(''); setShowReferrerPicker(false) }}
                >
                  <Text style={[fm.pickerOptionText, referredBy === '' && fm.pickerOptionActiveText]}>None</Text>
                </Pressable>

                {referrerSchools.length > 0 && (
                  <Text style={fm.pickerGroupLabel}>Client Schools</Text>
                )}
                {referrerSchools.map((s) => {
                  const val = `school:${s.id}`
                  const active = referredBy === val
                  return (
                    <Pressable
                      key={val}
                      style={[fm.pickerOption, active && fm.pickerOptionActive]}
                      onPress={() => { setReferredBy(val); setShowReferrerPicker(false) }}
                    >
                      <Text style={[fm.pickerOptionText, active && fm.pickerOptionActiveText]}>{s.name}</Text>
                    </Pressable>
                  )
                })}

                {referrerLeads.length > 0 && (
                  <Text style={fm.pickerGroupLabel}>Pipeline Leads</Text>
                )}
                {referrerLeads.map((l) => {
                  const val = `lead:${l.id}`
                  const active = referredBy === val
                  return (
                    <Pressable
                      key={val}
                      style={[fm.pickerOption, active && fm.pickerOptionActive]}
                      onPress={() => { setReferredBy(val); setShowReferrerPicker(false) }}
                    >
                      <Text style={[fm.pickerOptionText, active && fm.pickerOptionActiveText]}>{l.schoolName}</Text>
                      <Text style={fm.pickerOptionSub}>{l.pipelineStage.replace(/_/g, ' ')}</Text>
                    </Pressable>
                  )
                })}
              </ScrollView>
            </View>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </Modal>
  )
}

// ─── Stage Move Modal ────────────────────────────────────────────────────────

interface StageMoveModalProps {
  visible: boolean
  lead: Lead | null
  onClose: () => void
}

function StageMoveModal({ visible, lead, onClose }: StageMoveModalProps) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (stage: PipelineStage) =>
      api.put(`/leads/${lead!.id}`, { pipelineStage: stage }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      onClose()
    },
    onError: () => Alert.alert('Error', 'Failed to update stage.'),
  })

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={fm.overlay} onPress={onClose}>
        <View style={fm.pickerModal}>
          <Text style={fm.pickerModalTitle}>Move to Stage</Text>
          {PIPELINE_STAGES.map((s) => (
            <Pressable
              key={s}
              style={[fm.pickerOption, lead?.pipelineStage === s && fm.pickerOptionActive]}
              onPress={() => mutation.mutate(s)}
              disabled={mutation.isPending}
            >
              <Text style={[fm.pickerOptionText, lead?.pipelineStage === s && fm.pickerOptionActiveText]}>
                {STAGE_LABELS[s]}
              </Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  )
}

// ─── Bulk Action Bar ─────────────────────────────────────────────────────────

interface BulkActionBarProps {
  selectedIds: number[]
  leads: Lead[]
  onClear: () => void
  isAdmin: boolean
}

function BulkActionBar({ selectedIds, leads, onClear, isAdmin }: BulkActionBarProps) {
  const queryClient = useQueryClient()
  const [showAssignPicker, setShowAssignPicker] = useState(false)
  const [showStagePicker, setShowStagePicker] = useState(false)
  const [exporting, setExporting] = useState(false)

  const { data: users = [] } = useQuery<UserSummary[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
  })

  const bulkMutation = useMutation({
    mutationFn: (dto: Record<string, unknown>) =>
      api.post('/leads/bulk', dto).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      onClear()
    },
    onError: () => Alert.alert('Error', 'Bulk action failed.'),
  })

  async function handleExport() {
    setExporting(true)
    try {
      const selected = leads.filter((l) => selectedIds.includes(l.id))
      const rows = selected.map((l) => ({
        ID: l.id,
        School: l.schoolName,
        Contact: l.contactPerson,
        Phone: l.phone,
        Email: l.email ?? '',
        Location: l.location ?? '',
        Status: l.status,
        Stage: l.pipelineStage,
        AssignedTo: l.assignedTo?.name ?? '',
        Students: l.totalStudents ?? '',
        Created: l.createdAt,
      }))
      const headers = Object.keys(rows[0])
      const csv = [
        headers.join(','),
        ...rows.map((r) =>
          Object.values(r).map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')
        ),
      ].join('\n')
      const path = `${FileSystem.cacheDirectory}leads_export_${Date.now()}.csv`
      await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 })
      await Sharing.shareAsync(path, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' })
    } catch (e) {
      Alert.alert('Error', 'Export failed.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <View style={ba.bar}>
      <Text style={ba.count}>{selectedIds.length} selected</Text>
      <Pressable style={ba.btn} onPress={() => setShowAssignPicker(true)}>
        <Text style={ba.btnText}>Assign</Text>
      </Pressable>
      <Pressable style={ba.btn} onPress={() => setShowStagePicker(true)}>
        <Text style={ba.btnText}>Stage</Text>
      </Pressable>
      <Pressable style={ba.btn} onPress={handleExport} disabled={exporting}>
        <Text style={ba.btnText}>{exporting ? '...' : 'Export'}</Text>
      </Pressable>
      {isAdmin && (
        <Pressable
          style={ba.btnDanger}
          onPress={() => {
            Alert.alert(
              'Delete leads?',
              `Permanently delete ${selectedIds.length} lead${selectedIds.length === 1 ? '' : 's'}? This cannot be undone.`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => bulkMutation.mutate({ ids: selectedIds, action: 'delete' }),
                },
              ],
            )
          }}
          disabled={bulkMutation.isPending}
        >
          <Text style={ba.btnText}>Delete</Text>
        </Pressable>
      )}
      <Pressable style={ba.cancel} onPress={onClear}>
        <Text style={ba.cancelText}>✕</Text>
      </Pressable>

      <Modal visible={showAssignPicker} transparent animationType="fade" onRequestClose={() => setShowAssignPicker(false)}>
        <Pressable style={fm.overlay} onPress={() => setShowAssignPicker(false)}>
          <View style={fm.pickerModal}>
            <Text style={fm.pickerModalTitle}>Assign Selected To</Text>
            {users.map((u) => (
              <Pressable
                key={u.id}
                style={fm.pickerOption}
                onPress={() => {
                  bulkMutation.mutate({ ids: selectedIds, action: 'assign', assignedToId: u.id })
                  setShowAssignPicker(false)
                }}
              >
                <Text style={fm.pickerOptionText}>{u.name}</Text>
                <Text style={fm.pickerOptionSub}>{u.role}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showStagePicker} transparent animationType="fade" onRequestClose={() => setShowStagePicker(false)}>
        <Pressable style={fm.overlay} onPress={() => setShowStagePicker(false)}>
          <View style={fm.pickerModal}>
            <Text style={fm.pickerModalTitle}>Move Selected to Stage</Text>
            {PIPELINE_STAGES.map((s) => (
              <Pressable
                key={s}
                style={fm.pickerOption}
                onPress={() => {
                  bulkMutation.mutate({ ids: selectedIds, action: 'stage', pipelineStage: s })
                  setShowStagePicker(false)
                }}
              >
                <Text style={fm.pickerOptionText}>{STAGE_LABELS[s]}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  )
}

// ─── Lead Card (List View) ───────────────────────────────────────────────────

interface LeadCardProps {
  lead: Lead
  onPress: () => void
  onLongPress: () => void
  selected: boolean
  selectionMode: boolean
}

function LeadCard({ lead, onPress, onLongPress, selected, selectionMode }: LeadCardProps) {
  return (
    <Pressable
      style={[lc.card, selected && lc.cardSelected]}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      {selectionMode && (
        <View style={[lc.checkbox, selected && lc.checkboxSelected]}>
          {selected && <Text style={lc.checkmark}>✓</Text>}
        </View>
      )}
      <View style={lc.body}>
        <View style={lc.row}>
          <Text style={lc.schoolName} numberOfLines={1}>{lead.schoolName}</Text>
          <StatusBadge status={lead.status} size="sm" />
        </View>
        <View style={lc.row}>
          <Text style={lc.contactText}>{lead.contactPerson}</Text>
          <Text style={lc.phone}>{lead.phone}</Text>
        </View>
        <View style={[lc.row, { justifyContent: 'flex-end' }]}>
          <ContactActions phone={lead.phone} email={lead.email ?? undefined} size="sm" />
        </View>
        <View style={lc.row}>
          <StatusBadge status={lead.pipelineStage} size="sm" />
          {lead.assignedTo && (
            <Text style={lc.assigned} numberOfLines={1}>{lead.assignedTo.name}</Text>
          )}
        </View>
        {lead.referredBySchool && (
          <Text style={lc.referral} numberOfLines={1}>
            Referred by: {lead.referredBySchool.name}
          </Text>
        )}
      </View>
    </Pressable>
  )
}

// ─── Draggable Mini Card (swipe horizontally to move stages) ────────────────

const DRAG_THRESHOLD = 70

interface DraggableMiniCardProps {
  lead: Lead
  cardBg: string
  onPress: () => void
  onOpenMove: () => void
  onShift: (direction: 1 | -1) => void
  canShiftLeft: boolean
  canShiftRight: boolean
}

function DraggableMiniCard({
  lead,
  cardBg,
  onPress,
  onOpenMove,
  onShift,
  canShiftLeft,
  canShiftRight,
}: DraggableMiniCardProps) {
  const pan = useRef(new Animated.ValueXY()).current
  const [dragging, setDragging] = useState(false)

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      // Only capture when the user is clearly moving horizontally, so taps on
      // child Pressables (phone, move btn) still work and the horizontal
      // ScrollView still wins for large sideways drags.
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: () => setDragging(true),
      onPanResponderMove: Animated.event([null, { dx: pan.x }], { useNativeDriver: false }),
      onPanResponderRelease: (_e, g) => {
        setDragging(false)
        const shouldMoveRight = g.dx > DRAG_THRESHOLD && canShiftRight
        const shouldMoveLeft  = g.dx < -DRAG_THRESHOLD && canShiftLeft
        if (shouldMoveRight || shouldMoveLeft) {
          Animated.timing(pan, {
            toValue: { x: shouldMoveRight ? 260 : -260, y: 0 },
            duration: 140,
            useNativeDriver: false,
          }).start(() => {
            pan.setValue({ x: 0, y: 0 })
            onShift(shouldMoveRight ? 1 : -1)
          })
        } else {
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
            friction: 6,
            tension: 80,
          }).start()
        }
      },
      onPanResponderTerminate: () => {
        setDragging(false)
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
        }).start()
      },
    }),
  ).current

  return (
    <Animated.View
      {...responder.panHandlers}
      style={[
        pc.card,
        { backgroundColor: cardBg },
        dragging && pc.cardDragging,
        { transform: [{ translateX: pan.x }] },
      ]}
    >
      <Pressable onPress={onPress}>
        <Text style={pc.schoolName} numberOfLines={2}>{lead.schoolName}</Text>
        <View style={pc.cardRow}>
          <StatusBadge status={lead.status} size="sm" />
        </View>
        <Text style={pc.phone}>{lead.phone}</Text>
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
        <ContactActions phone={lead.phone} size="sm" gap={4} />
        <Pressable style={pc.moveBtn} onPress={onOpenMove}>
          <Text style={pc.moveBtnText}>Move</Text>
        </Pressable>
      </View>
      {dragging && (
        <Text style={pc.dragHint}>
          {canShiftLeft ? '◀ ' : ''}swipe to change stage{canShiftRight ? ' ▶' : ''}
        </Text>
      )}
    </Animated.View>
  )
}

// ─── Pipeline Column ─────────────────────────────────────────────────────────

interface PipelineColumnProps {
  stage: PipelineStage
  leads: Lead[]
  onPressMini: (lead: Lead) => void
  onMoveStage: (lead: Lead) => void
  onShiftStage: (lead: Lead, nextStage: PipelineStage) => void
}

function PipelineColumn({ stage, leads, onPressMini, onMoveStage, onShiftStage }: PipelineColumnProps) {
  const colors = STAGE_COLORS[stage]
  const stageIdx = PIPELINE_STAGES.indexOf(stage)
  const canShiftLeft  = stageIdx > 0
  const canShiftRight = stageIdx < PIPELINE_STAGES.length - 1
  return (
    <View style={pc.column}>
      <View style={[pc.header, { backgroundColor: colors.header }]}>
        <Text style={[pc.headerText, { color: colors.headerText }]}>{STAGE_LABELS[stage]}</Text>
        <View style={pc.countBadge}>
          <Text style={pc.countText}>{leads.length}</Text>
        </View>
      </View>
      <ScrollView style={pc.cards} showsVerticalScrollIndicator={false} nestedScrollEnabled>
        {leads.length === 0 && (
          <Text style={pc.emptyText}>No leads</Text>
        )}
        {leads.map((lead) => (
          <DraggableMiniCard
            key={lead.id}
            lead={lead}
            cardBg={colors.card}
            onPress={() => onPressMini(lead)}
            onOpenMove={() => onMoveStage(lead)}
            onShift={(direction) => {
              const next = PIPELINE_STAGES[stageIdx + direction]
              if (next) onShiftStage(lead, next)
            }}
            canShiftLeft={canShiftLeft}
            canShiftRight={canShiftRight}
          />
        ))}
      </ScrollView>
    </View>
  )
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function LeadsScreen() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'list' | 'pipeline'>('list')
  const [showNewLead, setShowNewLead] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [selectionMode, setSelectionMode] = useState(false)
  const [stageMoveTarget, setStageMoveTarget] = useState<Lead | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const queryClient = useQueryClient()

  const { data, isLoading, refetch, isRefetching } = useQuery<PaginatedLeads>({
    queryKey: ['leads', search],
    queryFn: () =>
      api.get('/leads', { params: { search: search || undefined, limit: 50 } }).then((r) => r.data),
  })

  const leads = data?.data ?? []
  const total = data?.total ?? 0

  // Debounced search
  function handleSearchChange(text: string) {
    setSearchInput(text)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setSearch(text), 300)
  }

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [])

  // Drag-to-shift mutation for the Kanban pipeline view
  const shiftStageMutation = useMutation({
    mutationFn: ({ id, pipelineStage }: { id: number; pipelineStage: PipelineStage }) =>
      api.put(`/leads/${id}`, { pipelineStage }).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
    onError: () => Alert.alert('Error', 'Failed to update stage.'),
  })

  function handleCardPress(lead: Lead) {
    if (selectionMode) {
      toggleSelect(lead.id)
    } else {
      router.push(`/(app)/leads/${lead.id}`)
    }
  }

  function handleCardLongPress(lead: Lead) {
    if (!selectionMode) {
      setSelectionMode(true)
      setSelectedIds([lead.id])
    }
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  function clearSelection() {
    setSelectionMode(false)
    setSelectedIds([])
  }

  const stageMap = PIPELINE_STAGES.reduce<Record<string, Lead[]>>((acc, stage) => {
    acc[stage] = leads.filter((l) => l.pipelineStage === stage)
    return acc
  }, {} as Record<string, Lead[]>)

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Leads & Pipeline</Text>
          {!isLoading && <Text style={s.headerCount}>{total} leads total</Text>}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable style={s.importBtn} onPress={() => setShowImport(true)}>
            <Text style={s.importBtnText}>Import</Text>
          </Pressable>
          <Pressable style={s.newBtn} onPress={() => setShowNewLead(true)}>
            <Text style={s.newBtnText}>+ New</Text>
          </Pressable>
        </View>
      </View>

      {/* Search */}
      <View style={s.searchRow}>
        <SearchBar
          value={searchInput}
          onChangeText={handleSearchChange}
          placeholder="Search leads..."
        />
      </View>

      {/* View Toggle */}
      <View style={s.toggleRow}>
        <Pressable
          style={[s.toggleBtn, view === 'list' && s.toggleBtnActive]}
          onPress={() => setView('list')}
        >
          <Text style={[s.toggleText, view === 'list' && s.toggleTextActive]}>List</Text>
        </Pressable>
        <Pressable
          style={[s.toggleBtn, view === 'pipeline' && s.toggleBtnActive]}
          onPress={() => setView('pipeline')}
        >
          <Text style={[s.toggleText, view === 'pipeline' && s.toggleTextActive]}>Pipeline</Text>
        </Pressable>
      </View>

      {/* Bulk Action Bar */}
      {selectionMode && (
        <BulkActionBar
          selectedIds={selectedIds}
          leads={leads}
          onClear={clearSelection}
          isAdmin={user?.role === 'ADMIN'}
        />
      )}

      {/* List View */}
      {view === 'list' && (
        isLoading ? (
          <LoadingSpinner />
        ) : (
          <FlatList
            data={leads}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={s.list}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={C.primary} />
            }
            ListEmptyComponent={
              <EmptyState
                title="No leads found"
                subtitle={search ? 'Try a different search term' : 'Tap "+ New Lead" to get started'}
              />
            }
            renderItem={({ item }) => (
              <LeadCard
                lead={item}
                onPress={() => handleCardPress(item)}
                onLongPress={() => handleCardLongPress(item)}
                selected={selectedIds.includes(item.id)}
                selectionMode={selectionMode}
              />
            )}
          />
        )
      )}

      {/* Pipeline View */}
      {view === 'pipeline' && (
        isLoading ? (
          <LoadingSpinner />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.pipelineContainer}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={C.primary} />
            }
          >
            {PIPELINE_STAGES.map((stage) => (
              <PipelineColumn
                key={stage}
                stage={stage}
                leads={stageMap[stage] ?? []}
                onPressMini={(lead) => router.push(`/(app)/leads/${lead.id}`)}
                onMoveStage={(lead) => setStageMoveTarget(lead)}
                onShiftStage={(lead, nextStage) =>
                  shiftStageMutation.mutate({ id: lead.id, pipelineStage: nextStage })
                }
              />
            ))}
          </ScrollView>
        )
      )}

      {/* Lead Form Modal */}
      <LeadFormModal
        visible={showNewLead}
        onClose={() => setShowNewLead(false)}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['leads'] })}
      />

      {/* Stage Move Modal */}
      <StageMoveModal
        visible={stageMoveTarget !== null}
        lead={stageMoveTarget}
        onClose={() => setStageMoveTarget(null)}
      />

      {/* CSV Import Modal */}
      <ImportModal visible={showImport} onClose={() => setShowImport(false)} />
    </SafeAreaView>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: C.text },
  headerCount: { fontSize: 12, color: C.textSecondary, marginTop: 2 },
  newBtn: {
    backgroundColor: C.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  newBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  importBtn: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  importBtnText: { color: C.primary, fontSize: 14, fontWeight: '600' },
  searchRow: { paddingHorizontal: 16, paddingBottom: 10 },
  toggleRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: C.grayLight,
    borderRadius: 8,
    padding: 3,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 6,
    alignItems: 'center',
  },
  toggleBtnActive: { backgroundColor: C.surface, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 2 },
  toggleText: { fontSize: 14, fontWeight: '500', color: C.textSecondary },
  toggleTextActive: { color: C.text, fontWeight: '600' },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  pipelineContainer: { paddingHorizontal: 12, paddingBottom: 24, gap: 10, alignItems: 'flex-start' },
})

const lc = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
    flexDirection: 'row',
    gap: 10,
  },
  cardSelected: { borderColor: C.primary, backgroundColor: C.primaryLight },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxSelected: { backgroundColor: C.primary, borderColor: C.primary },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  body: { flex: 1, gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  schoolName: { fontSize: 15, fontWeight: '700', color: C.text, flex: 1 },
  contactText: { fontSize: 13, color: C.textSecondary, flex: 1 },
  phone: { fontSize: 13, color: C.primary, fontWeight: '500' },
  assigned: { fontSize: 12, color: C.textMuted, flex: 1, textAlign: 'right' },
  referral: { fontSize: 12, color: C.orange, fontStyle: 'italic' },
})

const pc = StyleSheet.create({
  column: {
    width: 180,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    maxHeight: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  headerText: { fontSize: 12, fontWeight: '700', flex: 1 },
  countBadge: { backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  countText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  cards: { padding: 8, flex: 1 },
  emptyText: { fontSize: 12, color: C.textMuted, textAlign: 'center', paddingVertical: 16 },
  card: {
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    gap: 6,
  },
  cardRow: { flexDirection: 'row', gap: 4 },
  schoolName: { fontSize: 13, fontWeight: '600', color: C.text, lineHeight: 18 },
  phone: { fontSize: 12, color: C.primary, fontWeight: '500' },
  moveBtn: {
    backgroundColor: 'rgba(0,0,0,0.07)',
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
  },
  moveBtnText: { fontSize: 11, fontWeight: '600', color: C.text },
  cardDragging: {
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    opacity: 0.95,
  },
  dragHint: {
    fontSize: 10,
    color: C.textMuted,
    textAlign: 'center',
    marginTop: 4,
    fontStyle: 'italic',
  },
})

const ba = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.text,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  count: { color: '#fff', fontSize: 13, fontWeight: '600', flex: 1 },
  btn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  btnDanger: {
    backgroundColor: C.error,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  btnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  cancel: { padding: 6 },
  cancelText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})

const fm = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.surface,
  },
  title: { fontSize: 18, fontWeight: '700', color: C.text },
  cancel: { fontSize: 15, color: C.primary, fontWeight: '500' },
  body: { padding: 16, gap: 4, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: '600', color: C.textSecondary, marginTop: 12, marginBottom: 4 },
  input: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: C.text,
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  picker: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerText: { fontSize: 14, color: C.text },
  pickerArrow: { fontSize: 12, color: C.textMuted },
  submit: {
    backgroundColor: C.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerModal: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 32,
    maxHeight: '70%',
  },
  pickerModalTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 12 },
  pickerOption: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 2,
  },
  pickerOptionActive: { backgroundColor: C.primaryLight },
  pickerOptionText: { fontSize: 14, fontWeight: '500', color: C.text },
  pickerOptionActiveText: { color: C.primary, fontWeight: '700' },
  pickerOptionSub: { fontSize: 12, color: C.textMuted, marginTop: 1 },
  pickerGroupLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 12,
  },
})
