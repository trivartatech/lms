import { useState, useMemo } from 'react'
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, ChevronDown, X, Download } from 'lucide-react-native'
import { C } from '@/lib/colors'
import { formatCurrency, formatDate, daysFromNow, todayISO } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { SearchBar } from '@/components/shared/SearchBar'
import { api } from '@/lib/api'
import { downloadAgreementPDF } from '@/lib/agreementPdf'
import type { Agreement, AgreementStatus, School } from '@lms/shared'

// ─── helpers ─────────────────────────────────────────────────────────────────

function addMonthsToDate(dateStr: string, months: number): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  d.setMonth(d.getMonth() + months)
  return d.toISOString().split('T')[0]
}

// ─── Types ────────────────────────────────────────────────────────────────────

type AgreementFormData = {
  schoolId: number | null
  startDate: string
  durationMonths: string
  endDate: string
  value: string
  advancePayment: string
  totalInstalments: string
  notes: string
  status: AgreementStatus
}

const BLANK_FORM = (): AgreementFormData => ({
  schoolId: null,
  startDate: todayISO(),
  durationMonths: '12',
  endDate: addMonthsToDate(todayISO(), 12),
  value: '',
  advancePayment: '0',
  totalInstalments: '1',
  notes: '',
  status: 'ACTIVE',
})

const STATUS_OPTIONS: AgreementStatus[] = ['ACTIVE', 'EXPIRED', 'PENDING_RENEWAL']

// ─── Agreement card ───────────────────────────────────────────────────────────

function AgreementCard({
  agreement,
  onEdit,
}: {
  agreement: Agreement
  onEdit: (a: Agreement) => void
}) {
  const instalment =
    agreement.totalInstalments > 0
      ? (agreement.value - agreement.advancePayment) / agreement.totalInstalments
      : 0

  const renewalDays =
    agreement.renewalDate ? daysFromNow(agreement.renewalDate) : null
  const renewalUrgent = renewalDays !== null && renewalDays < 14

  return (
    <View style={s.card}>
      {/* Header row: school name + status + edit */}
      <View style={s.cardHeader}>
        <View style={s.cardHeaderLeft}>
          <Text style={s.schoolName} numberOfLines={1}>
            {agreement.school?.name ?? `School #${agreement.schoolId}`}
          </Text>
          {agreement.school?.location ? (
            <Text style={s.location}>{agreement.school.location}</Text>
          ) : null}
        </View>
        <View style={s.cardHeaderRight}>
          <StatusBadge status={agreement.status} size="sm" />
          <Pressable
            style={s.editBtn}
            onPress={() => downloadAgreementPDF(agreement)}
            hitSlop={6}
          >
            <Download size={15} color={C.primary} />
          </Pressable>
          <Pressable
            style={s.editBtn}
            onPress={() => onEdit(agreement)}
            hitSlop={6}
          >
            <Pencil size={15} color={C.primary} />
          </Pressable>
        </View>
      </View>

      {/* Duration row */}
      <View style={s.row}>
        <Text style={s.metaLabel}>Duration</Text>
        <Text style={s.metaValue}>
          {formatDate(agreement.startDate)} → {formatDate(agreement.endDate)}
        </Text>
      </View>

      {/* Annual value */}
      <View style={s.row}>
        <Text style={s.metaLabel}>Annual value</Text>
        <Text style={s.valueText}>{formatCurrency(agreement.value)}</Text>
      </View>

      {/* Advance */}
      {agreement.advancePayment > 0 && (
        <View style={s.row}>
          <Text style={s.metaLabel}>Advance received</Text>
          <Text style={s.advanceText}>
            {formatCurrency(agreement.advancePayment)}
          </Text>
        </View>
      )}

      {/* Instalment breakdown */}
      {agreement.totalInstalments > 0 && instalment > 0 && (
        <View style={s.row}>
          <Text style={s.metaLabel}>Instalments</Text>
          <Text style={s.metaValue}>
            {agreement.totalInstalments} × {formatCurrency(Math.round(instalment))}
          </Text>
        </View>
      )}

      {/* Renewal date */}
      {agreement.renewalDate && (
        <View style={s.row}>
          <Text style={s.metaLabel}>Renewal date</Text>
          <Text style={[s.metaValue, renewalUrgent && s.renewalUrgent]}>
            {formatDate(agreement.renewalDate)}
            {renewalUrgent
              ? renewalDays! <= 0
                ? '  (overdue!)'
                : `  (in ${renewalDays} days)`
              : ''}
          </Text>
        </View>
      )}

      {/* Notes */}
      {agreement.notes ? (
        <Text style={s.notes} numberOfLines={2}>
          {agreement.notes}
        </Text>
      ) : null}
    </View>
  )
}

// ─── School picker dropdown ───────────────────────────────────────────────────

function SchoolPickerModal({
  visible,
  onSelect,
  onClose,
}: {
  visible: boolean
  onSelect: (school: School) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery<{ data: School[]; total: number }>({
    queryKey: ['schools', 'picker'],
    queryFn: () => api.get('/schools', { params: { limit: 200 } }).then((r) => r.data),
    enabled: visible,
  })

  const filtered = useMemo(() => {
    const schools = data?.data ?? []
    if (!search.trim()) return schools
    return schools.filter((sc) =>
      sc.name.toLowerCase().includes(search.toLowerCase()),
    )
  }, [data, search])

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={sp.wrapper}>
        <View style={sp.header}>
          <Text style={sp.title}>Select School</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={20} color={C.textSecondary} />
          </Pressable>
        </View>
        <View style={sp.searchWrap}>
          <SearchBar
            value={search}
            onChangeText={setSearch}
            placeholder="Search schools…"
          />
        </View>
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={sp.list}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [sp.item, pressed && sp.itemPressed]}
                onPress={() => {
                  onSelect(item)
                  setSearch('')
                }}
              >
                <Text style={sp.itemName}>{item.name}</Text>
                {item.location ? (
                  <Text style={sp.itemSub}>{item.location}</Text>
                ) : null}
              </Pressable>
            )}
            ListEmptyComponent={
              <EmptyState title="No schools found" subtitle="Try a different search" />
            }
          />
        )}
      </View>
    </Modal>
  )
}

// ─── Agreement form modal ─────────────────────────────────────────────────────

function AgreementFormModal({
  visible,
  editAgreement,
  preselectedSchool,
  onClose,
  onSuccess,
}: {
  visible: boolean
  editAgreement: Agreement | null
  preselectedSchool: School | null
  onClose: () => void
  onSuccess: () => void
}) {
  const isEdit = editAgreement !== null
  const [form, setForm] = useState<AgreementFormData>(BLANK_FORM)
  const [schoolLabel, setSchoolLabel] = useState('')
  const [showStatus, setShowStatus] = useState(false)
  const queryClient = useQueryClient()

  // Sync form when modal opens/changes target
  const syncForm = () => {
    if (isEdit && editAgreement) {
      const months = (() => {
        const s = new Date(editAgreement.startDate)
        const e = new Date(editAgreement.endDate)
        return (
          (e.getFullYear() - s.getFullYear()) * 12 +
          (e.getMonth() - s.getMonth())
        ).toString()
      })()
      setForm({
        schoolId: editAgreement.schoolId,
        startDate: editAgreement.startDate,
        durationMonths: months,
        endDate: editAgreement.endDate,
        value: editAgreement.value.toString(),
        advancePayment: editAgreement.advancePayment.toString(),
        totalInstalments: editAgreement.totalInstalments.toString(),
        notes: editAgreement.notes ?? '',
        status: editAgreement.status,
      })
      setSchoolLabel(editAgreement.school?.name ?? `School #${editAgreement.schoolId}`)
    } else if (preselectedSchool) {
      const blank = BLANK_FORM()
      setForm({ ...blank, schoolId: preselectedSchool.id })
      setSchoolLabel(preselectedSchool.name)
    } else {
      setForm(BLANK_FORM())
      setSchoolLabel('')
    }
  }

  const set = <K extends keyof AgreementFormData>(k: K, v: AgreementFormData[K]) => {
    setForm((prev) => {
      const next = { ...prev, [k]: v }
      // Auto-calculate endDate when startDate or durationMonths changes
      if (k === 'startDate' || k === 'durationMonths') {
        const months = parseInt(
          k === 'durationMonths' ? (v as string) : next.durationMonths,
        )
        const start = k === 'startDate' ? (v as string) : next.startDate
        if (!isNaN(months) && months > 0) {
          next.endDate = addMonthsToDate(start, months)
        }
      }
      return next
    })
  }

  const createMutation = useMutation({
    mutationFn: (payload: object) => api.post('/agreements', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agreements'] })
      onSuccess()
    },
    onError: () => Alert.alert('Error', 'Failed to save agreement. Please try again.'),
  })

  const updateMutation = useMutation({
    mutationFn: (payload: object) =>
      api.put(`/agreements/${editAgreement!.id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agreements'] })
      onSuccess()
    },
    onError: () => Alert.alert('Error', 'Failed to update agreement. Please try again.'),
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  const handleSubmit = () => {
    if (!form.schoolId && !isEdit) {
      Alert.alert('Required', 'Please select a school.')
      return
    }
    if (!form.startDate) {
      Alert.alert('Required', 'Start date is required.')
      return
    }
    const valueNum = parseFloat(form.value)
    if (isNaN(valueNum) || valueNum <= 0) {
      Alert.alert('Required', 'Enter a valid annual value.')
      return
    }
    const advanceNum = parseFloat(form.advancePayment) || 0
    const instNum = parseInt(form.totalInstalments) || 1

    if (isEdit) {
      updateMutation.mutate({
        startDate: form.startDate,
        endDate: form.endDate,
        value: valueNum,
        advancePayment: advanceNum,
        totalInstalments: instNum,
        notes: form.notes || undefined,
        status: form.status,
      })
    } else {
      createMutation.mutate({
        schoolId: form.schoolId,
        startDate: form.startDate,
        endDate: form.endDate,
        value: valueNum,
        advancePayment: advanceNum,
        totalInstalments: instNum,
        notes: form.notes || undefined,
      })
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onShow={syncForm}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={fm.header}>
          <Text style={fm.title}>
            {isEdit ? 'Edit Agreement' : 'New Agreement'}
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={20} color={C.textSecondary} />
          </Pressable>
        </View>

        <ScrollView
          style={fm.body}
          contentContainerStyle={fm.bodyContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* School (read-only in edit, display label) */}
          <View style={fm.field}>
            <Text style={fm.label}>School</Text>
            <View style={fm.readonlyInput}>
              <Text style={fm.readonlyText}>{schoolLabel || 'No school selected'}</Text>
            </View>
          </View>

          {/* Start date */}
          <View style={fm.field}>
            <Text style={fm.label}>Start Date (YYYY-MM-DD)</Text>
            <TextInput
              style={fm.input}
              value={form.startDate}
              onChangeText={(v) => set('startDate', v)}
              placeholder="2024-01-01"
              placeholderTextColor={C.textMuted}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
          </View>

          {/* Duration months */}
          <View style={fm.field}>
            <Text style={fm.label}>Duration (months, 1–36)</Text>
            <TextInput
              style={fm.input}
              value={form.durationMonths}
              onChangeText={(v) => {
                const n = parseInt(v)
                if (!isNaN(n) && n >= 1 && n <= 36) set('durationMonths', v)
                else if (v === '') set('durationMonths', v)
              }}
              placeholder="12"
              placeholderTextColor={C.textMuted}
              keyboardType="numeric"
              maxLength={2}
            />
          </View>

          {/* End date (computed, read-only) */}
          <View style={fm.field}>
            <Text style={fm.label}>End Date (auto-calculated)</Text>
            <View style={fm.readonlyInput}>
              <Text style={fm.readonlyText}>{form.endDate || '—'}</Text>
            </View>
          </View>

          {/* Annual value */}
          <View style={fm.field}>
            <Text style={fm.label}>Annual Value (₹)</Text>
            <TextInput
              style={fm.input}
              value={form.value}
              onChangeText={(v) => set('value', v)}
              placeholder="e.g. 120000"
              placeholderTextColor={C.textMuted}
              keyboardType="numeric"
            />
          </View>

          {/* Advance payment */}
          <View style={fm.field}>
            <Text style={fm.label}>Advance Payment (₹)</Text>
            <TextInput
              style={fm.input}
              value={form.advancePayment}
              onChangeText={(v) => set('advancePayment', v)}
              placeholder="0"
              placeholderTextColor={C.textMuted}
              keyboardType="numeric"
            />
          </View>

          {/* Total instalments */}
          <View style={fm.field}>
            <Text style={fm.label}>Total Instalments</Text>
            <TextInput
              style={fm.input}
              value={form.totalInstalments}
              onChangeText={(v) => set('totalInstalments', v)}
              placeholder="1"
              placeholderTextColor={C.textMuted}
              keyboardType="numeric"
              maxLength={2}
            />
            {(() => {
              const val = parseFloat(form.value) || 0
              const adv = parseFloat(form.advancePayment) || 0
              const inst = parseInt(form.totalInstalments) || 1
              const each = inst > 0 ? (val - adv) / inst : 0
              return each > 0 ? (
                <Text style={fm.hint}>
                  {inst} × {formatCurrency(Math.round(each))} per instalment
                </Text>
              ) : null
            })()}
          </View>

          {/* Status (edit only) */}
          {isEdit && (
            <View style={fm.field}>
              <Text style={fm.label}>Status</Text>
              <Pressable
                style={fm.picker}
                onPress={() => setShowStatus((v) => !v)}
              >
                <Text style={fm.pickerText}>{form.status.replace(/_/g, ' ')}</Text>
                <ChevronDown size={16} color={C.textSecondary} />
              </Pressable>
              {showStatus && (
                <View style={fm.dropdown}>
                  {STATUS_OPTIONS.map((opt) => (
                    <Pressable
                      key={opt}
                      style={[
                        fm.dropdownItem,
                        form.status === opt && fm.dropdownItemActive,
                      ]}
                      onPress={() => {
                        set('status', opt)
                        setShowStatus(false)
                      }}
                    >
                      <Text
                        style={[
                          fm.dropdownItemText,
                          form.status === opt && fm.dropdownItemTextActive,
                        ]}
                      >
                        {opt.replace(/_/g, ' ')}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Notes */}
          <View style={fm.field}>
            <Text style={fm.label}>Notes (optional)</Text>
            <TextInput
              style={[fm.input, fm.textarea]}
              value={form.notes}
              onChangeText={(v) => set('notes', v)}
              placeholder="Any additional notes…"
              placeholderTextColor={C.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <Pressable
            style={[fm.submitBtn, isPending && fm.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={isPending}
          >
            {isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={fm.submitText}>
                {isEdit ? 'Save Changes' : 'Create Agreement'}
              </Text>
            )}
          </Pressable>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function AgreementsScreen() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [editTarget, setEditTarget] = useState<Agreement | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showSchoolPicker, setShowSchoolPicker] = useState(false)
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null)

  const { data: agreements, isLoading, isRefetching, refetch } = useQuery<Agreement[]>({
    queryKey: ['agreements'],
    queryFn: () => api.get('/agreements').then((r) => r.data),
  })

  const filtered = useMemo(() => {
    const all = agreements ?? []
    if (!search.trim()) return all
    return all.filter((a) =>
      (a.school?.name ?? '').toLowerCase().includes(search.toLowerCase()),
    )
  }, [agreements, search])

  const handleEdit = (agreement: Agreement) => {
    setEditTarget(agreement)
    setShowForm(true)
  }

  const handleNewPress = () => {
    setEditTarget(null)
    setSelectedSchool(null)
    setShowSchoolPicker(true)
  }

  const handleSchoolSelected = (school: School) => {
    setSelectedSchool(school)
    setShowSchoolPicker(false)
    setShowForm(true)
  }

  const handleFormClose = () => {
    setShowForm(false)
    setEditTarget(null)
    setSelectedSchool(null)
  }

  const handleFormSuccess = () => {
    handleFormClose()
    queryClient.invalidateQueries({ queryKey: ['agreements'] })
  }

  if (isLoading) {
    return (
      <SafeAreaView style={s.safe} edges={['bottom']}>
        <LoadingSpinner />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      {/* Top bar */}
      <View style={s.topBar}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search by school name…"
        />
      </View>

      {/* Count note */}
      {agreements && (
        <View style={s.countRow}>
          <Text style={s.countText}>
            {filtered.length} agreement{filtered.length !== 1 ? 's' : ''}
            {search ? ` matching "${search}"` : ''}
          </Text>
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={s.list}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={C.primary}
            colors={[C.primary]}
          />
        }
        renderItem={({ item }) => (
          <AgreementCard agreement={item} onEdit={handleEdit} />
        )}
        ListEmptyComponent={
          <EmptyState
            title={search ? 'No agreements match your search' : 'No agreements yet'}
            subtitle={search ? 'Try a different name' : 'Tap + to add the first agreement'}
          />
        }
      />

      {/* FAB */}
      <Pressable
        style={({ pressed }) => [s.fab, pressed && s.fabPressed]}
        onPress={handleNewPress}
      >
        <Plus size={26} color="#fff" />
      </Pressable>

      {/* School picker */}
      <SchoolPickerModal
        visible={showSchoolPicker}
        onSelect={handleSchoolSelected}
        onClose={() => setShowSchoolPicker(false)}
      />

      {/* Agreement form modal */}
      <AgreementFormModal
        visible={showForm}
        editAgreement={editTarget}
        preselectedSchool={selectedSchool}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
      />
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.bg,
  },
  topBar: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  countRow: {
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  countText: {
    fontSize: 12,
    color: C.textMuted,
  },
  list: {
    paddingHorizontal: 14,
    paddingBottom: 100,
  },

  // Card
  card: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 8,
  },
  cardHeaderLeft: {
    flex: 1,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  schoolName: {
    fontSize: 16,
    fontWeight: '700',
    color: C.text,
    marginBottom: 2,
  },
  location: {
    fontSize: 12,
    color: C.textMuted,
  },
  editBtn: {
    padding: 6,
    backgroundColor: C.primaryLight,
    borderRadius: 8,
  },

  // Info rows
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: C.grayLight,
  },
  metaLabel: {
    fontSize: 12,
    color: C.textSecondary,
    flex: 1,
  },
  metaValue: {
    fontSize: 12,
    color: C.text,
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  valueText: {
    fontSize: 15,
    fontWeight: '700',
    color: C.primary,
    flex: 2,
    textAlign: 'right',
  },
  advanceText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.successText,
    flex: 2,
    textAlign: 'right',
  },
  renewalUrgent: {
    color: C.error,
    fontWeight: '700',
  },
  notes: {
    marginTop: 8,
    fontSize: 12,
    color: C.textSecondary,
    fontStyle: 'italic',
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  fabPressed: {
    backgroundColor: C.primaryDark,
  },
})

const sp = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
    paddingTop: 56,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: C.text,
  },
  searchWrap: {
    padding: 12,
  },
  list: {
    paddingHorizontal: 14,
    paddingBottom: 32,
  },
  item: {
    backgroundColor: C.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  itemPressed: {
    backgroundColor: C.primaryLight,
    borderColor: C.primary,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: C.text,
  },
  itemSub: {
    fontSize: 12,
    color: C.textMuted,
    marginTop: 2,
  },
})

const fm = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
    paddingTop: 56,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: C.text,
  },
  body: {
    flex: 1,
    backgroundColor: C.bg,
  },
  bodyContent: {
    padding: 16,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: C.text,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: C.text,
    backgroundColor: C.surface,
  },
  textarea: {
    height: 80,
    textAlignVertical: 'top',
  },
  readonlyInput: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: C.grayLight,
  },
  readonlyText: {
    fontSize: 15,
    color: C.textSecondary,
  },
  hint: {
    fontSize: 12,
    color: C.success,
    marginTop: 4,
    fontWeight: '500',
  },
  picker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: C.surface,
  },
  pickerText: {
    fontSize: 15,
    color: C.text,
    fontWeight: '500',
  },
  dropdown: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    marginTop: 4,
    backgroundColor: C.surface,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.grayLight,
  },
  dropdownItemActive: {
    backgroundColor: C.primaryLight,
  },
  dropdownItemText: {
    fontSize: 14,
    color: C.text,
  },
  dropdownItemTextActive: {
    color: C.primary,
    fontWeight: '700',
  },
  submitBtn: {
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
})
