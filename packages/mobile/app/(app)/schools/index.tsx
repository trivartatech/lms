import { useState, useMemo } from 'react'
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Linking,
  SafeAreaView,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { Building2, MapPin } from 'lucide-react-native'
import { C } from '@/lib/colors'
import { formatDate, todayISO } from '@/lib/utils'
import { SearchBar } from '@/components/shared/SearchBar'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { ContactActions } from '@/components/shared/ContactActions'
import { AppRefreshControl } from '@/components/shared/AppRefreshControl'
import { api } from '@/lib/api'
import type { School, User } from '@lms/shared'

interface PaginatedSchools {
  data: School[]
  total: number
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function SchoolsScreen() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const { data, isLoading, refetch } = useQuery<PaginatedSchools>({
    queryKey: ['schools'],
    queryFn: () => api.get('/schools').then((r) => r.data),
  })

  const allSchools = data?.data ?? []

  const filtered = useMemo(() => {
    if (!search.trim()) return allSchools
    const q = search.toLowerCase()
    return allSchools.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.contactPerson.toLowerCase().includes(q) ||
        (s.location ?? '').toLowerCase().includes(q),
    )
  }, [allSchools, search])

  const onRefresh = async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }

  const daysAgo = (dateStr: string) => {
    const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
    if (d === 0) return 'Added today'
    if (d === 1) return 'Added 1 day ago'
    return `Added ${d} days ago`
  }

  if (isLoading) return <LoadingSpinner />

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Schools</Text>
          <Text style={s.headerCount}>{data?.total ?? 0} total</Text>
        </View>
        <Pressable style={s.addBtn} onPress={() => setShowForm(true)}>
          <Text style={s.addBtnText}>+ Add School</Text>
        </Pressable>
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search schools…" />
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[s.list, filtered.length === 0 && { flex: 1 }]}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <EmptyState
            title={search ? 'No schools match your search' : 'No schools yet'}
            subtitle={search ? 'Try a different search term' : 'Add your first school to get started'}
          />
        }
        renderItem={({ item: school }) => (
          <Pressable
            style={({ pressed }) => [s.card, pressed && s.cardPressed]}
            onPress={() => router.push(`/(app)/schools/${school.id}`)}
          >
            {/* Card header */}
            <View style={s.cardHeader}>
              <View style={s.schoolIconWrap}>
                <Building2 size={20} color={C.primary} />
              </View>
              <View style={s.cardHeaderText}>
                <Text style={s.schoolName} numberOfLines={1}>{school.name}</Text>
                <Text style={s.contactPerson} numberOfLines={1}>{school.contactPerson}</Text>
              </View>
            </View>

            {/* Phone row */}
            <View style={s.phoneRow}>
              <Text style={s.phoneText}>{school.phone}</Text>
              <View onStartShouldSetResponder={() => true}>
                <ContactActions
                  phone={school.phone}
                  email={school.email ?? undefined}
                  size="sm"
                />
              </View>
            </View>

            {/* Location */}
            {school.location ? (
              <View style={s.locationRow}>
                <MapPin size={12} color={C.textMuted} />
                <Text style={s.location} numberOfLines={1}>{school.location}</Text>
              </View>
            ) : null}

            {/* Referred by badge */}
            {school.referredBySchool ? (
              <View style={s.referredBadge}>
                <Text style={s.referredText}>Referred by: {school.referredBySchool.name}</Text>
              </View>
            ) : null}

            {/* Footer */}
            <Text style={s.timestamp}>{daysAgo(school.createdAt)}</Text>
          </Pressable>
        )}
      />

      {/* School Form Modal */}
      <SchoolFormModal
        visible={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['schools'] })
          setShowForm(false)
        }}
      />
    </SafeAreaView>
  )
}

// ── School Form Modal ─────────────────────────────────────────────────────────

function SchoolFormModal({
  visible,
  onClose,
  onSuccess,
}: {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const blankForm = () => ({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    location: '',
    totalStudents: '',
    notes: '',
    assignedToId: '' as string,
    referredBySchoolId: '' as string,
  })

  const [form, setForm] = useState(blankForm)
  const [showUserPicker, setShowUserPicker] = useState(false)
  const [showSchoolPicker, setShowSchoolPicker] = useState(false)

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const { data: usersData } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
    enabled: visible,
  })

  const { data: schoolsData } = useQuery<{ data: School[]; total: number }>({
    queryKey: ['schools'],
    queryFn: () => api.get('/schools').then((r) => r.data),
    enabled: visible,
  })

  const users = usersData ?? []
  const schools = schoolsData?.data ?? []

  const selectedUser = users.find((u) => String(u.id) === form.assignedToId)
  const selectedSchool = schools.find((s) => String(s.id) === form.referredBySchoolId)

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/schools', {
        name: form.name.trim(),
        contactPerson: form.contactPerson.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        location: form.location.trim() || undefined,
        totalStudents: form.totalStudents ? parseInt(form.totalStudents, 10) : undefined,
        notes: form.notes.trim() || undefined,
        assignedToId: form.assignedToId ? parseInt(form.assignedToId, 10) : undefined,
        referredBySchoolId: form.referredBySchoolId ? parseInt(form.referredBySchoolId, 10) : undefined,
      }),
    onSuccess: () => {
      setForm(blankForm())
      onSuccess()
      Alert.alert('Success', 'School created successfully!')
    },
    onError: () => Alert.alert('Error', 'Failed to create school. Please try again.'),
  })

  const submit = () => {
    if (!form.name.trim() || !form.contactPerson.trim() || !form.phone.trim()) {
      Alert.alert('Required Fields', 'Name, Contact Person, and Phone are required.')
      return
    }
    mutation.mutate()
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={fm.header}>
          <Text style={fm.title}>Add School</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={fm.cancel}>Cancel</Text>
          </Pressable>
        </View>

        <ScrollView style={fm.body} keyboardShouldPersistTaps="handled">
          {/* Name */}
          <View style={fm.field}>
            <Text style={fm.label}>School Name *</Text>
            <TextInput
              style={fm.input}
              placeholder="Enter school name"
              placeholderTextColor={C.textMuted}
              value={form.name}
              onChangeText={(v) => set('name', v)}
              autoCapitalize="words"
            />
          </View>

          {/* Contact person */}
          <View style={fm.field}>
            <Text style={fm.label}>Contact Person *</Text>
            <TextInput
              style={fm.input}
              placeholder="Full name"
              placeholderTextColor={C.textMuted}
              value={form.contactPerson}
              onChangeText={(v) => set('contactPerson', v)}
              autoCapitalize="words"
            />
          </View>

          {/* Phone */}
          <View style={fm.field}>
            <Text style={fm.label}>Phone *</Text>
            <TextInput
              style={fm.input}
              placeholder="Phone number"
              placeholderTextColor={C.textMuted}
              value={form.phone}
              onChangeText={(v) => set('phone', v)}
              keyboardType="phone-pad"
            />
          </View>

          {/* Email */}
          <View style={fm.field}>
            <Text style={fm.label}>Email</Text>
            <TextInput
              style={fm.input}
              placeholder="email@school.com"
              placeholderTextColor={C.textMuted}
              value={form.email}
              onChangeText={(v) => set('email', v)}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* Location */}
          <View style={fm.field}>
            <Text style={fm.label}>Location</Text>
            <TextInput
              style={fm.input}
              placeholder="City / Area"
              placeholderTextColor={C.textMuted}
              value={form.location}
              onChangeText={(v) => set('location', v)}
              autoCapitalize="words"
            />
          </View>

          {/* Total Students */}
          <View style={fm.field}>
            <Text style={fm.label}>Total Students</Text>
            <TextInput
              style={fm.input}
              placeholder="e.g. 500"
              placeholderTextColor={C.textMuted}
              value={form.totalStudents}
              onChangeText={(v) => set('totalStudents', v)}
              keyboardType="numeric"
            />
          </View>

          {/* Assigned To picker */}
          <View style={fm.field}>
            <Text style={fm.label}>Assigned To</Text>
            <Pressable
              style={fm.picker}
              onPress={() => { setShowUserPicker((p) => !p); setShowSchoolPicker(false) }}
            >
              <Text style={selectedUser ? fm.pickerText : fm.pickerPlaceholder}>
                {selectedUser ? selectedUser.name : 'Select user…'}
              </Text>
              <Text style={fm.chevron}>{showUserPicker ? '▲' : '▼'}</Text>
            </Pressable>
            {showUserPicker && (
              <View style={fm.dropdown}>
                <Pressable style={fm.dropdownItem} onPress={() => { set('assignedToId', ''); setShowUserPicker(false) }}>
                  <Text style={fm.dropdownText}>— None —</Text>
                </Pressable>
                {users.map((u) => (
                  <Pressable
                    key={u.id}
                    style={[fm.dropdownItem, String(u.id) === form.assignedToId && fm.dropdownItemActive]}
                    onPress={() => { set('assignedToId', String(u.id)); setShowUserPicker(false) }}
                  >
                    <Text style={[fm.dropdownText, String(u.id) === form.assignedToId && { color: C.primary, fontWeight: '700' }]}>
                      {u.name}
                    </Text>
                    <Text style={fm.dropdownSub}>{u.role}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Referred By School picker */}
          <View style={fm.field}>
            <Text style={fm.label}>Referred By School</Text>
            <Pressable
              style={fm.picker}
              onPress={() => { setShowSchoolPicker((p) => !p); setShowUserPicker(false) }}
            >
              <Text style={selectedSchool ? fm.pickerText : fm.pickerPlaceholder}>
                {selectedSchool ? selectedSchool.name : 'Select school…'}
              </Text>
              <Text style={fm.chevron}>{showSchoolPicker ? '▲' : '▼'}</Text>
            </Pressable>
            {showSchoolPicker && (
              <View style={fm.dropdown}>
                <Pressable style={fm.dropdownItem} onPress={() => { set('referredBySchoolId', ''); setShowSchoolPicker(false) }}>
                  <Text style={fm.dropdownText}>— None —</Text>
                </Pressable>
                {schools.map((sc) => (
                  <Pressable
                    key={sc.id}
                    style={[fm.dropdownItem, String(sc.id) === form.referredBySchoolId && fm.dropdownItemActive]}
                    onPress={() => { set('referredBySchoolId', String(sc.id)); setShowSchoolPicker(false) }}
                  >
                    <Text style={[fm.dropdownText, String(sc.id) === form.referredBySchoolId && { color: C.primary, fontWeight: '700' }]}>
                      {sc.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Notes */}
          <View style={fm.field}>
            <Text style={fm.label}>Notes</Text>
            <TextInput
              style={[fm.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Any additional notes"
              placeholderTextColor={C.textMuted}
              value={form.notes}
              onChangeText={(v) => set('notes', v)}
              multiline
            />
          </View>

          <Pressable style={fm.submitBtn} onPress={submit} disabled={mutation.isPending}>
            {mutation.isPending
              ? <ActivityIndicator color="#fff" />
              : <Text style={fm.submitText}>Create School</Text>}
          </Pressable>
          <View style={{ height: 48 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: C.text },
  headerCount: { fontSize: 12, color: C.textSecondary, marginTop: 1 },
  addBtn: {
    backgroundColor: C.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  searchWrap: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: C.surface },
  list: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 32 },
  card: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardPressed: { opacity: 0.85 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  schoolIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: C.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  cardHeaderText: { flex: 1 },
  schoolName: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 1 },
  contactPerson: { fontSize: 13, color: C.textSecondary },
  phoneRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  phoneLabel: { fontSize: 13, marginRight: 4 },
  phoneText: { flex: 1, fontSize: 13, color: C.textSecondary },
  callBtn: {
    backgroundColor: C.successLight,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  callBtnText: { fontSize: 12, color: C.successText, fontWeight: '600' },
  location: { fontSize: 12, color: C.textMuted, flex: 1 },
  referredBadge: {
    alignSelf: 'flex-start',
    backgroundColor: C.purpleLight,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 6,
  },
  referredText: { fontSize: 11, color: C.purple, fontWeight: '600' },
  timestamp: { fontSize: 11, color: C.textMuted, marginTop: 2 },
})

const fm = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 56,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.surface,
  },
  title: { fontSize: 18, fontWeight: '700', color: C.text },
  cancel: { fontSize: 15, color: C.primary },
  body: { padding: 16 },
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: C.text,
    backgroundColor: C.surface,
  },
  picker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    padding: 12,
    backgroundColor: C.surface,
  },
  pickerText: { fontSize: 14, color: C.text, flex: 1 },
  pickerPlaceholder: { fontSize: 14, color: C.textMuted, flex: 1 },
  chevron: { color: C.textSecondary, fontSize: 11 },
  dropdown: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    marginTop: 4,
    backgroundColor: C.surface,
    maxHeight: 220,
    overflow: 'scroll',
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.grayLight,
  },
  dropdownItemActive: { backgroundColor: C.primaryLight },
  dropdownText: { fontSize: 14, color: C.text, flex: 1 },
  dropdownSub: { fontSize: 12, color: C.textMuted },
  submitBtn: {
    backgroundColor: C.primary,
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})
