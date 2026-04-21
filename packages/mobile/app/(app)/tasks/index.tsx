import { useState, useMemo, useEffect } from 'react'
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
  Alert,
  TextInput,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useOfflineMutation } from '@/hooks/useOfflineMutation'
import { useRouter } from 'expo-router'
import {
  Phone,
  Users,
  Bell,
  CheckCircle,
  Plus,
  ChevronDown,
  X,
  CalendarClock,
} from 'lucide-react-native'
import { C } from '@/lib/colors'
import { formatDate, todayISO } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { AppRefreshControl } from '@/components/shared/AppRefreshControl'
import { SearchBar } from '@/components/shared/SearchBar'
import { DatePickerField } from '@/components/shared/DatePickerField'
import { api } from '@/lib/api'
import type { Task, TaskType, UserSummary } from '@lms/shared'

// ─── Constants ────────────────────────────────────────────────────────────────

const TASK_TYPES: TaskType[] = ['CALL', 'MEETING', 'REMINDER']

const TYPE_META: Record<
  TaskType,
  { label: string; color: string; bg: string; Icon: typeof Phone }
> = {
  CALL:     { label: 'Call',     color: C.primary,  bg: C.primaryLight, Icon: Phone },
  MEETING:  { label: 'Meeting',  color: C.purple,   bg: C.purpleLight,  Icon: Users },
  REMINDER: { label: 'Reminder', color: C.warning,  bg: C.warningLight, Icon: Bell  },
}

type FilterTab = 'ALL' | 'PENDING' | 'COMPLETED'

// ─── Task form data ───────────────────────────────────────────────────────────

type TaskFormData = {
  title: string
  type: TaskType
  dueDate: string
  assignedToId: number | null
  notes: string
}

const BLANK_TASK = (): TaskFormData => ({
  title: '',
  type: 'CALL',
  dueDate: todayISO(),
  assignedToId: null,
  notes: '',
})

// ─── Task type icon ───────────────────────────────────────────────────────────

function TaskTypeIcon({ type }: { type: TaskType }) {
  const meta = TYPE_META[type]
  const Icon = meta.Icon
  return (
    <View style={[ti.circle, { backgroundColor: meta.bg }]}>
      <Icon size={18} color={meta.color} />
    </View>
  )
}

const ti = StyleSheet.create({
  circle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

// ─── Task card ────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  onComplete,
  onReschedule,
}: {
  task: Task
  onComplete: (task: Task) => void
  onReschedule: (task: Task) => void
}) {
  const router = useRouter()
  const isCompleted = task.status === 'COMPLETED'
  const isCancelled = task.status === 'CANCELLED'
  const isDimmed = isCompleted || isCancelled
  const isPending = task.status === 'PENDING'

  const isOverdue =
    isPending && new Date(task.dueDate) < new Date(new Date().setHours(0, 0, 0, 0))

  return (
    <View style={[s.card, isDimmed && s.cardDimmed]}>
      {/* Top row: icon + title + complete button */}
      <View style={s.cardTop}>
        <TaskTypeIcon type={task.type} />

        <View style={s.titleWrap}>
          <Text
            style={[
              s.taskTitle,
              isCompleted && s.taskTitleStrike,
              isDimmed && s.taskTitleDimmed,
            ]}
            numberOfLines={2}
          >
            {task.title}
          </Text>
        </View>

        {isPending && (
          <View style={s.actionCol}>
            <Pressable
              style={({ pressed }) => [s.completeBtn, pressed && s.completeBtnPressed]}
              onPress={() => onComplete(task)}
              hitSlop={8}
              accessibilityLabel="Mark task complete"
            >
              <CheckCircle size={28} color={C.success} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [s.rescheduleBtn, pressed && s.rescheduleBtnPressed]}
              onPress={() => onReschedule(task)}
              hitSlop={8}
              accessibilityLabel="Reschedule task"
            >
              <CalendarClock size={20} color={C.primary} />
            </Pressable>
          </View>
        )}
      </View>

      {/* Meta row */}
      <View style={s.metaRow}>
        <StatusBadge status={task.type} size="sm" />
        <StatusBadge status={task.status} size="sm" />
        <Text style={[s.dueText, isOverdue && s.dueOverdue]}>
          {isOverdue ? '⚠ ' : ''}{formatDate(task.dueDate)}
        </Text>
      </View>

      {/* Assigned to */}
      {task.assignedTo && (
        <Text style={s.assignedText}>
          Assigned: {task.assignedTo.name}
        </Text>
      )}

      {/* Linked entity */}
      {task.lead && (
        <Pressable
          onPress={() => router.push(`/(app)/leads/${task.lead!.id}` as any)}
        >
          <Text style={s.linkedText}>Lead: {task.lead.schoolName}</Text>
        </Pressable>
      )}
      {task.school && (
        <Pressable
          onPress={() => router.push(`/(app)/schools/${task.school!.id}` as any)}
        >
          <Text style={s.linkedText}>School: {task.school.name}</Text>
        </Pressable>
      )}

      {/* Notes */}
      {task.notes ? (
        <Text style={s.notesText} numberOfLines={2}>
          {task.notes}
        </Text>
      ) : null}
    </View>
  )
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

function FilterTabs({
  active,
  counts,
  onChange,
}: {
  active: FilterTab
  counts: Record<FilterTab, number>
  onChange: (tab: FilterTab) => void
}) {
  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'ALL', label: 'All' },
    { key: 'PENDING', label: 'Pending' },
    { key: 'COMPLETED', label: 'Completed' },
  ]

  return (
    <View style={ft.row}>
      {tabs.map((tab) => (
        <Pressable
          key={tab.key}
          style={[ft.tab, active === tab.key && ft.tabActive]}
          onPress={() => onChange(tab.key)}
        >
          <Text style={[ft.tabText, active === tab.key && ft.tabTextActive]}>
            {tab.label}
          </Text>
          <View
            style={[
              ft.badge,
              active === tab.key ? ft.badgeActive : ft.badgeInactive,
            ]}
          >
            <Text
              style={[
                ft.badgeText,
                active === tab.key && ft.badgeTextActive,
              ]}
            >
              {counts[tab.key]}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  )
}

const ft = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingBottom: 8,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: C.grayLight,
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 6,
  },
  tabActive: {
    backgroundColor: C.primaryLight,
    borderColor: C.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textSecondary,
  },
  tabTextActive: {
    color: C.primary,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeActive: {
    backgroundColor: C.primary,
  },
  badgeInactive: {
    backgroundColor: C.border,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.textSecondary,
  },
  badgeTextActive: {
    color: '#fff',
  },
})

// ─── Task form modal ──────────────────────────────────────────────────────────

function TaskFormModal({
  visible,
  onClose,
  onSuccess,
}: {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [form, setForm] = useState<TaskFormData>(BLANK_TASK)
  const [showTypePicker, setShowTypePicker] = useState(false)
  const [showUserPicker, setShowUserPicker] = useState(false)
  const [assignedLabel, setAssignedLabel] = useState('')
  const queryClient = useQueryClient()

  const { data: users } = useQuery<UserSummary[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
    enabled: visible,
  })

  const set = <K extends keyof TaskFormData>(k: K, v: TaskFormData[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }))

  const mutation = useMutation({
    mutationFn: (payload: object) => api.post('/tasks', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      setForm(BLANK_TASK())
      setAssignedLabel('')
      onSuccess()
    },
    onError: () => Alert.alert('Error', 'Failed to create task. Please try again.'),
  })

  const handleSubmit = () => {
    if (!form.title.trim()) {
      Alert.alert('Required', 'Task title is required.')
      return
    }
    if (!form.dueDate) {
      Alert.alert('Required', 'Due date is required.')
      return
    }
    mutation.mutate({
      title: form.title.trim(),
      type: form.type,
      dueDate: form.dueDate,
      assignedToId: form.assignedToId ?? undefined,
      notes: form.notes.trim() || undefined,
    })
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onShow={() => {
        setForm(BLANK_TASK())
        setAssignedLabel('')
      }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={tfm.header}>
          <Text style={tfm.title}>New Task</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={20} color={C.textSecondary} />
          </Pressable>
        </View>

        <ScrollView
          style={tfm.body}
          contentContainerStyle={tfm.bodyContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title */}
          <View style={tfm.field}>
            <Text style={tfm.label}>Title *</Text>
            <TextInput
              style={tfm.input}
              value={form.title}
              onChangeText={(v) => set('title', v)}
              placeholder="e.g. Follow up with principal"
              placeholderTextColor={C.textMuted}
              autoCapitalize="sentences"
            />
          </View>

          {/* Task type picker */}
          <View style={tfm.field}>
            <Text style={tfm.label}>Type</Text>
            <Pressable
              style={tfm.picker}
              onPress={() => setShowTypePicker((v) => !v)}
            >
              <View style={tfm.pickerLeft}>
                {(() => {
                  const meta = TYPE_META[form.type]
                  const Icon = meta.Icon
                  return <Icon size={16} color={meta.color} />
                })()}
                <Text style={tfm.pickerText}>{form.type}</Text>
              </View>
              <ChevronDown size={16} color={C.textSecondary} />
            </Pressable>
            {showTypePicker && (
              <View style={tfm.dropdown}>
                {TASK_TYPES.map((t) => {
                  const meta = TYPE_META[t]
                  const Icon = meta.Icon
                  return (
                    <Pressable
                      key={t}
                      style={[
                        tfm.dropdownItem,
                        form.type === t && tfm.dropdownItemActive,
                      ]}
                      onPress={() => {
                        set('type', t)
                        setShowTypePicker(false)
                      }}
                    >
                      <Icon size={14} color={meta.color} />
                      <Text
                        style={[
                          tfm.dropdownItemText,
                          form.type === t && tfm.dropdownItemTextActive,
                        ]}
                      >
                        {meta.label}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            )}
          </View>

          {/* Due date */}
          <View style={tfm.field}>
            <Text style={tfm.label}>Due Date *</Text>
            <DatePickerField
              value={form.dueDate}
              onChange={(v) => set('dueDate', v)}
              placeholder="Select due date"
              accessibilityLabel="Due date"
            />
          </View>

          {/* Assigned to picker */}
          <View style={tfm.field}>
            <Text style={tfm.label}>Assign To</Text>
            <Pressable
              style={tfm.picker}
              onPress={() => setShowUserPicker((v) => !v)}
            >
              <Text style={[tfm.pickerText, !assignedLabel && tfm.pickerPlaceholder]}>
                {assignedLabel || 'Select user (optional)'}
              </Text>
              <ChevronDown size={16} color={C.textSecondary} />
            </Pressable>
            {showUserPicker && (
              <View style={tfm.dropdown}>
                <Pressable
                  style={tfm.dropdownItem}
                  onPress={() => {
                    set('assignedToId', null)
                    setAssignedLabel('')
                    setShowUserPicker(false)
                  }}
                >
                  <Text style={tfm.dropdownItemText}>— Unassigned —</Text>
                </Pressable>
                {(users ?? []).map((u) => (
                  <Pressable
                    key={u.id}
                    style={[
                      tfm.dropdownItem,
                      form.assignedToId === u.id && tfm.dropdownItemActive,
                    ]}
                    onPress={() => {
                      set('assignedToId', u.id)
                      setAssignedLabel(u.name)
                      setShowUserPicker(false)
                    }}
                  >
                    <Text
                      style={[
                        tfm.dropdownItemText,
                        form.assignedToId === u.id && tfm.dropdownItemTextActive,
                      ]}
                    >
                      {u.name}
                    </Text>
                    <Text style={tfm.dropdownItemSub}>{u.role}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Notes */}
          <View style={tfm.field}>
            <Text style={tfm.label}>Notes (optional)</Text>
            <TextInput
              style={[tfm.input, tfm.textarea]}
              value={form.notes}
              onChangeText={(v) => set('notes', v)}
              placeholder="Any additional context…"
              placeholderTextColor={C.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <Pressable
            style={[tfm.submitBtn, mutation.isPending && tfm.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={tfm.submitText}>Create Task</Text>
            )}
          </Pressable>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ─── Reschedule modal ─────────────────────────────────────────────────────────

function RescheduleModal({
  task,
  onClose,
  onSuccess,
}: {
  task: Task | null
  onClose: () => void
  onSuccess: () => void
}) {
  const queryClient = useQueryClient()
  const [newDate, setNewDate] = useState('')

  // Seed the picker with the task's current due date whenever a new task is
  // targeted — we read the YYYY-MM-DD portion so no timezone shift.
  const visible = task !== null
  const seeded = useMemo(() => {
    if (!task?.dueDate) return ''
    return new Date(task.dueDate).toISOString().slice(0, 10)
  }, [task?.id, task?.dueDate])

  // Reset scratch value when the modal opens/closes or target task changes.
  useEffect(() => {
    if (visible) setNewDate(seeded)
    else setNewDate('')
  }, [visible, seeded])

  // Offline-capable: registered in mutation-defaults as ['tasks', 'reschedule'].
  // While offline, this mutation pauses in the cache and replays when NetInfo
  // flips back to online. The backend idempotency middleware dedupes replays
  // by the Idempotency-Key header stamped into variables.
  const mutation = useOfflineMutation<unknown, Error, { id: number; dueDate: string }>({
    mutationKey: ['tasks', 'reschedule'],
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      onSuccess()
    },
    // Fires only for errors surfaced while the component is still mounted
    // (i.e. the mutation actually ran and the server returned non-2xx). If
    // the app is offline the mutation pauses silently — no error alert.
    onError: () => Alert.alert('Error', 'Failed to reschedule task.'),
  })

  const handleSave = () => {
    if (!task) return
    if (!newDate) {
      Alert.alert('Required', 'Pick a new due date.')
      return
    }
    if (newDate === seeded) {
      onClose()
      return
    }
    mutation.mutate({ id: task.id, dueDate: newDate })
    // Close immediately: if offline, the mutation is safely queued; the
    // OfflineStatusPill in the header reflects the pending count.
    onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={rs.backdrop} onPress={onClose}>
        <Pressable style={rs.sheet} onPress={() => {}}>
          <View style={rs.header}>
            <Text style={rs.title}>Reschedule Task</Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close">
              <X size={20} color={C.textSecondary} />
            </Pressable>
          </View>

          {task && (
            <View style={rs.body}>
              <Text style={rs.taskTitle} numberOfLines={2}>{task.title}</Text>
              <Text style={rs.currentDue}>
                Currently due: <Text style={rs.currentDueValue}>{formatDate(task.dueDate)}</Text>
              </Text>

              <Text style={rs.label}>New due date</Text>
              <DatePickerField
                value={newDate}
                onChange={setNewDate}
                placeholder="Select new due date"
                accessibilityLabel="New due date"
              />
            </View>
          )}

          <View style={rs.actions}>
            <Pressable
              onPress={onClose}
              style={[rs.btn, rs.btnGhost]}
              disabled={mutation.isPending}
            >
              <Text style={rs.btnGhostText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              style={[rs.btn, rs.btnPrimary, mutation.isPending && rs.btnDisabled]}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={rs.btnPrimaryText}>Save</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const rs = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sheet: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: C.surface,
    borderRadius: 14,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: C.text,
  },
  body: {
    padding: 16,
    gap: 4,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: C.text,
    marginBottom: 4,
  },
  currentDue: {
    fontSize: 13,
    color: C.textSecondary,
    marginBottom: 16,
  },
  currentDueValue: {
    fontWeight: '600',
    color: C.text,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: C.text,
    marginBottom: 6,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.grayLight,
  },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhost: {
    backgroundColor: 'transparent',
  },
  btnGhostText: {
    color: C.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  btnPrimary: {
    backgroundColor: C.primary,
  },
  btnPrimaryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  btnDisabled: {
    opacity: 0.7,
  },
})

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function TasksScreen() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterTab>('ALL')
  const [showForm, setShowForm] = useState(false)
  const [confirmTask, setConfirmTask] = useState<Task | null>(null)
  const [rescheduleTask, setRescheduleTask] = useState<Task | null>(null)

  const { data: tasks, isLoading, isRefetching, refetch } = useQuery<Task[]>({
    queryKey: ['tasks'],
    queryFn: () => api.get('/tasks').then((r) => r.data),
  })

  // Offline-capable: registered in mutation-defaults as ['tasks', 'complete'].
  // Pauses while offline and replays on reconnect. Variables are an object
  // (not a bare number) so useOfflineMutation can stamp the idempotency key
  // into them for stable replay.
  const completeMutation = useOfflineMutation<unknown, Error, { id: number }>({
    mutationKey: ['tasks', 'complete'],
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: () => {
      Alert.alert('Error', 'Failed to mark task as complete.')
    },
  })

  // Build counts per tab
  const counts = useMemo<Record<FilterTab, number>>(() => {
    const all = tasks ?? []
    return {
      ALL: all.length,
      PENDING: all.filter((t) => t.status === 'PENDING').length,
      COMPLETED: all.filter((t) => t.status === 'COMPLETED').length,
    }
  }, [tasks])

  // Apply filter then search
  const filtered = useMemo(() => {
    let list = tasks ?? []
    if (activeFilter === 'PENDING') list = list.filter((t) => t.status === 'PENDING')
    if (activeFilter === 'COMPLETED') list = list.filter((t) => t.status === 'COMPLETED')
    if (search.trim()) {
      list = list.filter((t) =>
        t.title.toLowerCase().includes(search.toLowerCase()),
      )
    }
    return list
  }, [tasks, activeFilter, search])

  if (isLoading) {
    return (
      <SafeAreaView style={s.safe} edges={['bottom']}>
        <LoadingSpinner />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      {/* Search bar */}
      <View style={s.searchWrap}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search tasks…"
        />
      </View>

      {/* Filter tabs */}
      <FilterTabs active={activeFilter} counts={counts} onChange={setActiveFilter} />

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={s.list}
        refreshControl={
          <AppRefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        renderItem={({ item }) => (
          <TaskCard
            task={item}
            onComplete={(t) => setConfirmTask(t)}
            onReschedule={(t) => setRescheduleTask(t)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            title={
              search
                ? 'No tasks match your search'
                : activeFilter === 'PENDING'
                ? 'No pending tasks'
                : activeFilter === 'COMPLETED'
                ? 'No completed tasks yet'
                : 'No tasks yet'
            }
            subtitle={
              search
                ? 'Try a different title'
                : activeFilter === 'ALL'
                ? 'Tap + to create a new task'
                : undefined
            }
          />
        }
      />

      {/* FAB */}
      <Pressable
        style={({ pressed }) => [s.fab, pressed && s.fabPressed]}
        onPress={() => setShowForm(true)}
      >
        <Plus size={26} color="#fff" />
      </Pressable>

      {/* Complete confirm modal */}
      <ConfirmModal
        visible={confirmTask !== null}
        title="Mark as Complete"
        message={`Mark "${confirmTask?.title ?? ''}" as completed?`}
        confirmLabel="Complete"
        onConfirm={() => {
          if (confirmTask) {
            completeMutation.mutate({ id: confirmTask.id })
            // Close modal immediately — the mutation is queued if offline and
            // the pill in the header surfaces "Syncing N" until it drains.
            setConfirmTask(null)
          }
        }}
        onCancel={() => setConfirmTask(null)}
      />

      {/* New task modal */}
      <TaskFormModal
        visible={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={() => setShowForm(false)}
      />

      {/* Reschedule modal */}
      <RescheduleModal
        task={rescheduleTask}
        onClose={() => setRescheduleTask(null)}
        onSuccess={() => setRescheduleTask(null)}
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
  searchWrap: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
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
  cardDimmed: {
    opacity: 0.6,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  titleWrap: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: C.text,
    lineHeight: 20,
  },
  taskTitleStrike: {
    textDecorationLine: 'line-through',
    textDecorationStyle: 'solid',
  },
  taskTitleDimmed: {
    color: C.textMuted,
  },
  actionCol: {
    alignItems: 'center',
    gap: 4,
  },
  completeBtn: {
    padding: 2,
  },
  completeBtnPressed: {
    opacity: 0.6,
  },
  rescheduleBtn: {
    padding: 4,
    borderRadius: 14,
    backgroundColor: C.primaryLight,
  },
  rescheduleBtnPressed: {
    opacity: 0.6,
  },

  // Meta
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  dueText: {
    fontSize: 12,
    color: C.textSecondary,
    fontWeight: '500',
  },
  dueOverdue: {
    color: C.error,
    fontWeight: '700',
  },

  // Assigned / Linked
  assignedText: {
    fontSize: 12,
    color: C.textSecondary,
    marginTop: 2,
  },
  linkedText: {
    fontSize: 12,
    color: C.primary,
    fontWeight: '600',
    marginTop: 4,
    textDecorationLine: 'underline',
  },
  notesText: {
    fontSize: 12,
    color: C.textSecondary,
    fontStyle: 'italic',
    marginTop: 6,
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

const tfm = StyleSheet.create({
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
  pickerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pickerText: {
    fontSize: 15,
    color: C.text,
    fontWeight: '500',
  },
  pickerPlaceholder: {
    color: C.textMuted,
    fontWeight: '400',
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.grayLight,
    gap: 8,
  },
  dropdownItemActive: {
    backgroundColor: C.primaryLight,
  },
  dropdownItemText: {
    fontSize: 14,
    color: C.text,
    flex: 1,
  },
  dropdownItemTextActive: {
    color: C.primary,
    fontWeight: '700',
  },
  dropdownItemSub: {
    fontSize: 11,
    color: C.textMuted,
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
