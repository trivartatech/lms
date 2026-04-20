import { useState, useMemo } from 'react'
import {
  View,
  Text,
  ScrollView,
  FlatList,
  Pressable,
  Modal,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Linking,
  SafeAreaView,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { C } from '@/lib/colors'
import { formatCurrency, formatDate, getInitials, todayISO, addMonths } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { ContactActions } from '@/components/shared/ContactActions'
import { api } from '@/lib/api'
import type {
  School,
  Contact,
  Agreement,
  Quotation,
  Addon,
  SchoolAddon,
  Task,
  ReferralListItem,
  User,
} from '@lms/shared'

// ── Tab config ────────────────────────────────────────────────────────────────

const TABS = ['Overview', 'Contacts', 'Agreements', 'Quotations', 'Add-Ons', 'Tasks', 'Referrals'] as const
type Tab = (typeof TABS)[number]

const QUOTATION_STATUS_COLORS: Record<string, string> = {
  DRAFT: C.textSecondary,
  SENT: C.primary,
  ACCEPTED: C.success,
  REJECTED: C.error,
}

const TASK_TYPE_ICONS: Record<string, string> = {
  CALL: '📞',
  MEETING: '🤝',
  REMINDER: '🔔',
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function SchoolDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('Overview')

  // Modal visibility state
  const [showEditSchool, setShowEditSchool] = useState(false)
  const [showContactForm, setShowContactForm] = useState(false)
  const [showContactEdit, setShowContactEdit] = useState<Contact | null>(null)
  const [showAgreementForm, setShowAgreementForm] = useState(false)
  const [showAgreementEdit, setShowAgreementEdit] = useState<Agreement | null>(null)
  const [showQuotationForm, setShowQuotationForm] = useState(false)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [showReferralForm, setShowReferralForm] = useState(false)
  const [deleteContact, setDeleteContact] = useState<Contact | null>(null)

  // ── Data queries ────────────────────────────────────────────────────────────

  const { data: school, isLoading: schoolLoading } = useQuery<School>({
    queryKey: ['schools', id],
    queryFn: () => api.get(`/schools/${id}`).then((r) => r.data),
  })

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ['contacts', 'school', id],
    queryFn: () => api.get(`/contacts/school/${id}`).then((r) => r.data),
    enabled: tab === 'Contacts' || tab === 'Overview',
  })

  const { data: agreements = [] } = useQuery<Agreement[]>({
    queryKey: ['agreements', { schoolId: id }],
    queryFn: () => api.get('/agreements', { params: { schoolId: id } }).then((r) => r.data),
    enabled: tab === 'Agreements' || tab === 'Overview',
  })

  const { data: quotations = [] } = useQuery<Quotation[]>({
    queryKey: ['quotations', { schoolId: id }],
    queryFn: () => api.get('/quotations', { params: { schoolId: id } }).then((r) => r.data),
    enabled: tab === 'Quotations',
  })

  const { data: catalog = [] } = useQuery<Addon[]>({
    queryKey: ['addons'],
    queryFn: () => api.get('/addons').then((r) => r.data),
    enabled: tab === 'Add-Ons' || tab === 'Quotations',
  })

  const { data: activeAddons = [] } = useQuery<SchoolAddon[]>({
    queryKey: ['schools', id, 'addons'],
    queryFn: () => api.get(`/schools/${id}/addons`).then((r) => r.data),
    enabled: tab === 'Add-Ons' || tab === 'Quotations',
  })

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ['tasks', { schoolId: id }],
    queryFn: () => api.get('/tasks', { params: { schoolId: id } }).then((r) => r.data),
    enabled: tab === 'Tasks' || tab === 'Overview',
  })

  const { data: referrals = [] } = useQuery<ReferralListItem[]>({
    queryKey: ['schools', id, 'referrals'],
    queryFn: () => api.get(`/schools/${id}/referrals`).then((r) => r.data),
    enabled: tab === 'Referrals',
  })

  // ── Mutations ───────────────────────────────────────────────────────────────

  const deleteContactMutation = useMutation({
    mutationFn: (contactId: number) => api.delete(`/contacts/${contactId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', 'school', id] })
      setDeleteContact(null)
    },
    onError: () => Alert.alert('Error', 'Failed to delete contact.'),
  })

  const removeAddonMutation = useMutation({
    mutationFn: (addonId: number) => api.delete(`/schools/${id}/addons/${addonId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schools', id, 'addons'] }),
    onError: () => Alert.alert('Error', 'Failed to remove add-on.'),
  })

  const completeTaskMutation = useMutation({
    mutationFn: (taskId: number) => api.put(`/tasks/${taskId}`, { status: 'COMPLETED' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', { schoolId: id }] }),
    onError: () => Alert.alert('Error', 'Failed to complete task.'),
  })

  // ── Derived data ────────────────────────────────────────────────────────────

  const activeAddonMap = useMemo(() => {
    const m = new Map<number, SchoolAddon>()
    for (const sa of activeAddons) m.set(sa.addonId, sa)
    return m
  }, [activeAddons])

  const erpItems = useMemo(() => catalog.filter((a) => a.category === 'ERP'), [catalog])
  const addonItems = useMemo(() => catalog.filter((a) => a.category === 'ADDON'), [catalog])

  const conversionRate = useMemo(() => {
    if (!referrals.length) return 0
    const converted = referrals.filter((r) => r.status === 'CONVERTED').length
    return Math.round((converted / referrals.length) * 100)
  }, [referrals])

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const renewalUrgency = (dateStr?: string) => {
    if (!dateStr) return false
    const daysLeft = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000)
    return daysLeft < 14
  }

  if (schoolLoading || !school) return <LoadingSpinner />

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={s.headerTitle} numberOfLines={2}>{school.name}</Text>
          {school.location ? <Text style={s.headerSub}>{school.location}</Text> : null}
        </View>
        <Pressable style={s.editBtn} onPress={() => setShowEditSchool(true)}>
          <Text style={s.editBtnText}>Edit</Text>
        </Pressable>
      </View>

      {/* Tab bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.tabBar}
        contentContainerStyle={s.tabBarContent}
      >
        {TABS.map((t) => (
          <Pressable key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Tab content */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

        {/* ════════════════════════════════════════════════════════════════
            TAB 1: OVERVIEW
        ════════════════════════════════════════════════════════════════ */}
        {tab === 'Overview' && (
          <View>
            {/* Contact info card */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Contact Info</Text>
              <InfoRow label="School" value={school.name} />
              <InfoRow label="Contact Person" value={school.contactPerson} />
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Phone</Text>
                <Text style={s.infoValue}>{school.phone}</Text>
              </View>
              {school.email ? (
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Email</Text>
                  <Text style={s.infoValue} numberOfLines={1}>{school.email}</Text>
                </View>
              ) : null}
              <View style={{ marginTop: 6, marginBottom: 4 }}>
                <ContactActions phone={school.phone} email={school.email ?? undefined} />
              </View>
              {school.location ? <InfoRow label="Location" value={school.location} /> : null}
              {school.totalStudents != null ? (
                <InfoRow label="Total Students" value={school.totalStudents.toLocaleString()} />
              ) : null}
              {school.referredBySchool ? (
                <InfoRow
                  label="Referred By"
                  value={school.referredBySchool.name}
                  onPress={() => router.push(`/(app)/schools/${school.referredBySchool!.id}`)}
                />
              ) : null}
              {school.assignedTo ? (
                <InfoRow label="Assigned To" value={school.assignedTo.name} />
              ) : null}
              <InfoRow label="Created" value={formatDate(school.createdAt)} />
            </View>

            {/* Quick stats */}
            <View style={s.statsRow}>
              <View style={s.statCard}>
                <Text style={s.statValue}>{contacts.length}</Text>
                <Text style={s.statLabel}>Contacts</Text>
              </View>
              <View style={s.statCard}>
                <Text style={s.statValue}>{agreements.length}</Text>
                <Text style={s.statLabel}>Agreements</Text>
              </View>
              <View style={s.statCard}>
                <Text style={s.statValue}>{tasks.filter((t) => t.status === 'PENDING').length}</Text>
                <Text style={s.statLabel}>Open Tasks</Text>
              </View>
            </View>
          </View>
        )}

        {/* ════════════════════════════════════════════════════════════════
            TAB 2: CONTACTS
        ════════════════════════════════════════════════════════════════ */}
        {tab === 'Contacts' && (
          <View>
            <Pressable style={s.newBtn} onPress={() => setShowContactForm(true)}>
              <Text style={s.newBtnText}>+ Add Contact</Text>
            </Pressable>
            {contacts.length === 0 ? (
              <EmptyState title="No contacts yet" subtitle="Add a contact person for this school" />
            ) : (
              contacts.map((contact) => (
                <View key={contact.id} style={s.contactCard}>
                  {/* Avatar */}
                  <View style={s.avatar}>
                    <Text style={s.avatarText}>{getInitials(contact.name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={s.contactNameRow}>
                      <Text style={s.contactName}>{contact.name}</Text>
                      {contact.isPrimary ? (
                        <View style={s.primaryBadge}>
                          <Text style={s.primaryBadgeText}>Primary</Text>
                        </View>
                      ) : null}
                    </View>
                    {contact.designation ? (
                      <Text style={s.contactDesig}>{contact.designation}</Text>
                    ) : null}
                    <Text style={s.contactLine}>{contact.phone}</Text>
                    {contact.email ? (
                      <Text style={s.contactLine} numberOfLines={1}>{contact.email}</Text>
                    ) : null}
                    <View style={{ marginTop: 4 }}>
                      <ContactActions phone={contact.phone} email={contact.email ?? undefined} size="sm" />
                    </View>
                  </View>
                  {/* Edit / Delete buttons */}
                  <View style={s.contactCtrl}>
                    <Pressable
                      style={s.iconBtn}
                      onPress={() => setShowContactEdit(contact)}
                      hitSlop={8}
                    >
                      <Text style={s.iconBtnText}>✎</Text>
                    </Pressable>
                    <Pressable
                      style={[s.iconBtn, { backgroundColor: C.errorLight }]}
                      onPress={() => setDeleteContact(contact)}
                      hitSlop={8}
                    >
                      <Text style={[s.iconBtnText, { color: C.error }]}>✕</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* ════════════════════════════════════════════════════════════════
            TAB 3: AGREEMENTS
        ════════════════════════════════════════════════════════════════ */}
        {tab === 'Agreements' && (
          <View>
            <Pressable style={s.newBtn} onPress={() => setShowAgreementForm(true)}>
              <Text style={s.newBtnText}>+ New Agreement</Text>
            </Pressable>
            {agreements.length === 0 ? (
              <EmptyState title="No agreements yet" subtitle="Create the first agreement for this school" />
            ) : (
              agreements.map((agr) => {
                const instalmentAmount =
                  agr.totalInstalments > 0
                    ? (Number(agr.value) - Number(agr.advancePayment)) / agr.totalInstalments
                    : 0
                const isUrgentRenewal = renewalUrgency(agr.renewalDate)
                return (
                  <View key={agr.id} style={s.agreementCard}>
                    <View style={s.agreementHeader}>
                      <StatusBadge status={agr.status} />
                      <Pressable style={s.editSmBtn} onPress={() => setShowAgreementEdit(agr)}>
                        <Text style={s.editSmBtnText}>Edit</Text>
                      </Pressable>
                    </View>
                    <Text style={s.agreementValue}>{formatCurrency(Number(agr.value))}<Text style={s.agreementValueSuffix}>/yr</Text></Text>
                    <Text style={s.agreementDuration}>
                      {formatDate(agr.startDate)} → {formatDate(agr.endDate)}
                    </Text>
                    {Number(agr.advancePayment) > 0 ? (
                      <Text style={s.advanceText}>
                        ✓ {formatCurrency(Number(agr.advancePayment))} advance received
                      </Text>
                    ) : null}
                    {agr.totalInstalments > 0 ? (
                      <Text style={s.instalmentText}>
                        {agr.totalInstalments} × {formatCurrency(Math.round(instalmentAmount))} instalments
                      </Text>
                    ) : null}
                    {agr.renewalDate ? (
                      <Text style={[s.renewalDate, isUrgentRenewal && s.renewalDateUrgent]}>
                        🔁 Renewal: {formatDate(agr.renewalDate)}
                        {isUrgentRenewal ? ' — Due soon!' : ''}
                      </Text>
                    ) : null}
                    {agr.notes ? <Text style={s.agreementNotes}>{agr.notes}</Text> : null}
                  </View>
                )
              })
            )}
          </View>
        )}

        {/* ════════════════════════════════════════════════════════════════
            TAB 4: QUOTATIONS
        ════════════════════════════════════════════════════════════════ */}
        {tab === 'Quotations' && (
          <View>
            <Pressable style={s.newBtn} onPress={() => setShowQuotationForm(true)}>
              <Text style={s.newBtnText}>+ New Quotation</Text>
            </Pressable>
            {quotations.length === 0 ? (
              <EmptyState title="No quotations yet" subtitle="Create a quotation for this school" />
            ) : (
              quotations.map((q) => (
                <Pressable
                  key={q.id}
                  style={({ pressed }) => [s.quotationCard, pressed && { opacity: 0.8 }]}
                  onPress={() => router.push(`/(app)/quotations/${q.id}`)}
                >
                  <View style={s.quotationRow}>
                    <View>
                      <Text style={s.quotationId}>Quotation #{q.id}</Text>
                      <Text style={s.quotationMeta}>
                        {q.items.length} item{q.items.length !== 1 ? 's' : ''} · {formatDate(q.createdAt)}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={s.quotationTotal}>{formatCurrency(Number(q.total))}</Text>
                      <StatusBadge status={q.status} size="sm" />
                    </View>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        )}

        {/* ════════════════════════════════════════════════════════════════
            TAB 5: ADD-ONS
        ════════════════════════════════════════════════════════════════ */}
        {tab === 'Add-Ons' && (
          <View>
            <Text style={s.sectionMeta}>
              {activeAddonMap.size} of {catalog.length} active
            </Text>
            {catalog.length === 0 ? (
              <EmptyState title="No add-ons in catalog" subtitle="Add products in Settings first" />
            ) : (
              [
                { label: 'ERP Packages', items: erpItems },
                { label: 'Add-Ons', items: addonItems },
              ].map(({ label, items }) =>
                items.length > 0 ? (
                  <View key={label}>
                    <Text style={s.groupLabel}>{label}</Text>
                    {items.map((addon) => {
                      const sa = activeAddonMap.get(addon.id)
                      const isActive = !!sa
                      return (
                        <View key={addon.id} style={[s.addonCard, isActive && s.addonCardActive]}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.addonName}>{addon.name}</Text>
                            <Text style={s.addonSub}>
                              {isActive
                                ? `${formatCurrency(Number(sa!.price))} · since ${formatDate(sa!.startDate)}`
                                : `Default: ${formatCurrency(Number(addon.price))}`}
                            </Text>
                          </View>
                          {isActive ? (
                            <Pressable
                              style={s.removeBtn}
                              onPress={() =>
                                Alert.alert('Remove Add-On', `Remove ${addon.name}?`, [
                                  { text: 'Cancel', style: 'cancel' },
                                  {
                                    text: 'Remove',
                                    style: 'destructive',
                                    onPress: () => removeAddonMutation.mutate(addon.id),
                                  },
                                ])
                              }
                            >
                              <Text style={s.removeBtnText}>✕ Remove</Text>
                            </Pressable>
                          ) : (
                            <ActivateAddonInline
                              addon={addon}
                              schoolId={parseInt(id!, 10)}
                              totalStudents={school.totalStudents}
                              onSuccess={() =>
                                queryClient.invalidateQueries({ queryKey: ['schools', id, 'addons'] })
                              }
                            />
                          )}
                        </View>
                      )
                    })}
                  </View>
                ) : null,
              )
            )}
          </View>
        )}

        {/* ════════════════════════════════════════════════════════════════
            TAB 6: TASKS
        ════════════════════════════════════════════════════════════════ */}
        {tab === 'Tasks' && (
          <View>
            <Pressable style={s.newBtn} onPress={() => setShowTaskForm(true)}>
              <Text style={s.newBtnText}>+ Add Task</Text>
            </Pressable>
            {tasks.length === 0 ? (
              <EmptyState title="No tasks yet" subtitle="Add a task or follow-up for this school" />
            ) : (
              tasks.map((task) => {
                const dueDays = Math.ceil(
                  (new Date(task.dueDate).getTime() - Date.now()) / 86_400_000,
                )
                const isOverdue = dueDays < 0
                return (
                  <View key={task.id} style={s.taskCard}>
                    <View style={s.taskLeft}>
                      <Text style={s.taskIcon}>{TASK_TYPE_ICONS[task.type] ?? '📋'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.taskTitle} numberOfLines={2}>{task.title}</Text>
                      <Text style={[s.taskDue, isOverdue && s.taskDueOverdue]}>
                        {isOverdue ? `${Math.abs(dueDays)}d overdue` : dueDays === 0 ? 'Due today' : `Due in ${dueDays}d`}
                        {' · '}{formatDate(task.dueDate)}
                      </Text>
                      {task.assignedTo ? (
                        <Text style={s.taskAssigned}>Assigned: {task.assignedTo.name}</Text>
                      ) : null}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <StatusBadge status={task.status} size="sm" />
                      {task.status === 'PENDING' ? (
                        <Pressable
                          style={s.completeBtn}
                          onPress={() =>
                            Alert.alert('Complete Task', 'Mark this task as completed?', [
                              { text: 'Cancel', style: 'cancel' },
                              { text: 'Complete', onPress: () => completeTaskMutation.mutate(task.id) },
                            ])
                          }
                        >
                          <Text style={s.completeBtnText}>✓ Done</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                )
              })
            )}
          </View>
        )}

        {/* ════════════════════════════════════════════════════════════════
            TAB 7: REFERRALS
        ════════════════════════════════════════════════════════════════ */}
        {tab === 'Referrals' && (
          <View>
            {/* Stats banner */}
            {referrals.length > 0 ? (
              <View style={s.referralStats}>
                <View style={s.referralStatItem}>
                  <Text style={s.referralStatValue}>{referrals.length}</Text>
                  <Text style={s.referralStatLabel}>Total Referrals</Text>
                </View>
                <View style={s.referralStatDivider} />
                <View style={s.referralStatItem}>
                  <Text style={[s.referralStatValue, { color: C.success }]}>{conversionRate}%</Text>
                  <Text style={s.referralStatLabel}>Conversion Rate</Text>
                </View>
              </View>
            ) : null}

            <Pressable style={s.newBtn} onPress={() => setShowReferralForm(true)}>
              <Text style={s.newBtnText}>+ Add Referral</Text>
            </Pressable>

            {referrals.length === 0 ? (
              <EmptyState title="No referrals yet" subtitle="Track schools referred by this school" />
            ) : (
              referrals.map((ref) => (
                <View key={ref.leadId} style={s.referralCard}>
                  <View style={s.referralHeader}>
                    <Text style={s.referralSchool}>{ref.schoolName}</Text>
                    <StatusBadge status={ref.status} size="sm" />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={s.referralContact}>{ref.contactPerson} · {ref.phone}</Text>
                    <ContactActions phone={ref.phone} size="sm" />
                  </View>
                  <View style={s.referralFooter}>
                    <Text style={s.referralStage}>{ref.pipelineStage?.replace(/_/g, ' ')}</Text>
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      {ref.commission ? (
                        <Text style={s.referralCommission}>{formatCurrency(ref.commission)}</Text>
                      ) : null}
                      {ref.payoutStatus ? (
                        <StatusBadge status={ref.payoutStatus} size="sm" />
                      ) : null}
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}

      {/* Edit School */}
      <SchoolEditModal
        visible={showEditSchool}
        school={school}
        onClose={() => setShowEditSchool(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['schools', id] })
          queryClient.invalidateQueries({ queryKey: ['schools'] })
          setShowEditSchool(false)
          Alert.alert('Updated', 'School updated successfully!')
        }}
      />

      {/* Contact Add */}
      <ContactFormModal
        visible={showContactForm}
        schoolId={parseInt(id!, 10)}
        onClose={() => setShowContactForm(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['contacts', 'school', id] })
          setShowContactForm(false)
        }}
      />

      {/* Contact Edit */}
      {showContactEdit ? (
        <ContactFormModal
          visible={!!showContactEdit}
          schoolId={parseInt(id!, 10)}
          contact={showContactEdit}
          onClose={() => setShowContactEdit(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['contacts', 'school', id] })
            setShowContactEdit(null)
          }}
        />
      ) : null}

      {/* Delete contact confirm */}
      <ConfirmModal
        visible={!!deleteContact}
        title="Delete Contact"
        message={`Remove ${deleteContact?.name} from this school?`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => deleteContact && deleteContactMutation.mutate(deleteContact.id)}
        onCancel={() => setDeleteContact(null)}
      />

      {/* Agreement Add */}
      <AgreementFormModal
        visible={showAgreementForm}
        schoolId={parseInt(id!, 10)}
        onClose={() => setShowAgreementForm(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['agreements', { schoolId: id }] })
          setShowAgreementForm(false)
          Alert.alert('Created', 'Agreement created!')
        }}
      />

      {/* Agreement Edit */}
      {showAgreementEdit ? (
        <AgreementFormModal
          visible={!!showAgreementEdit}
          schoolId={parseInt(id!, 10)}
          agreement={showAgreementEdit}
          onClose={() => setShowAgreementEdit(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['agreements', { schoolId: id }] })
            setShowAgreementEdit(null)
            Alert.alert('Updated', 'Agreement updated!')
          }}
        />
      ) : null}

      {/* Quotation */}
      <QuotationFormModal
        visible={showQuotationForm}
        schoolId={parseInt(id!, 10)}
        totalStudents={school.totalStudents ?? undefined}
        defaultAddons={activeAddons}
        onClose={() => setShowQuotationForm(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['quotations', { schoolId: id }] })
          setShowQuotationForm(false)
          Alert.alert('Created', 'Quotation created!')
        }}
      />

      {/* Task */}
      <TaskFormModal
        visible={showTaskForm}
        schoolId={parseInt(id!, 10)}
        onClose={() => setShowTaskForm(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['tasks', { schoolId: id }] })
          setShowTaskForm(false)
          Alert.alert('Created', 'Task added!')
        }}
      />

      {/* Referral */}
      <ReferralFormModal
        visible={showReferralForm}
        schoolId={parseInt(id!, 10)}
        onClose={() => setShowReferralForm(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['schools', id, 'referrals'] })
          setShowReferralForm(false)
          Alert.alert('Added', 'Referral added and lead created!')
        }}
      />
    </SafeAreaView>
  )
}

// ── SchoolEditModal ───────────────────────────────────────────────────────────

function SchoolEditModal({
  visible,
  school,
  onClose,
  onSuccess,
}: {
  visible: boolean
  school: School
  onClose: () => void
  onSuccess: () => void
}) {
  const [form, setForm] = useState({
    name: school.name,
    contactPerson: school.contactPerson,
    phone: school.phone,
    email: school.email ?? '',
    location: school.location ?? '',
    totalStudents: school.totalStudents != null ? String(school.totalStudents) : '',
    notes: school.notes ?? '',
  })
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const mutation = useMutation({
    mutationFn: () =>
      api.put(`/schools/${school.id}`, {
        name: form.name.trim(),
        contactPerson: form.contactPerson.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        location: form.location.trim() || undefined,
        totalStudents: form.totalStudents ? parseInt(form.totalStudents, 10) : undefined,
        notes: form.notes.trim() || undefined,
      }),
    onSuccess,
    onError: () => Alert.alert('Error', 'Failed to update school.'),
  })

  const submit = () => {
    if (!form.name.trim() || !form.contactPerson.trim() || !form.phone.trim()) {
      Alert.alert('Required', 'Name, Contact Person and Phone are required.')
      return
    }
    mutation.mutate()
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={fm.header}>
          <Text style={fm.title}>Edit School</Text>
          <Pressable onPress={onClose} hitSlop={8}><Text style={fm.cancel}>Cancel</Text></Pressable>
        </View>
        <ScrollView style={fm.body} keyboardShouldPersistTaps="handled">
          {[
            { key: 'name', label: 'School Name *', placeholder: 'School name', kbType: 'default' },
            { key: 'contactPerson', label: 'Contact Person *', placeholder: 'Full name', kbType: 'default' },
            { key: 'phone', label: 'Phone *', placeholder: 'Phone number', kbType: 'phone-pad' },
            { key: 'email', label: 'Email', placeholder: 'email@school.com', kbType: 'email-address' },
            { key: 'location', label: 'Location', placeholder: 'City / Area', kbType: 'default' },
            { key: 'totalStudents', label: 'Total Students', placeholder: 'e.g. 500', kbType: 'numeric' },
          ].map((f) => (
            <View key={f.key} style={fm.field}>
              <Text style={fm.label}>{f.label}</Text>
              <TextInput
                style={fm.input}
                placeholder={f.placeholder}
                placeholderTextColor={C.textMuted}
                value={(form as any)[f.key]}
                onChangeText={(v) => set(f.key, v)}
                keyboardType={f.kbType as any}
                autoCapitalize={f.kbType === 'email-address' ? 'none' : 'words'}
              />
            </View>
          ))}
          <View style={fm.field}>
            <Text style={fm.label}>Notes</Text>
            <TextInput
              style={[fm.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Optional notes"
              placeholderTextColor={C.textMuted}
              value={form.notes}
              onChangeText={(v) => set('notes', v)}
              multiline
            />
          </View>
          <Pressable style={fm.submitBtn} onPress={submit} disabled={mutation.isPending}>
            {mutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={fm.submitText}>Save Changes</Text>}
          </Pressable>
          <View style={{ height: 48 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ── ContactFormModal ──────────────────────────────────────────────────────────

function ContactFormModal({
  visible,
  schoolId,
  contact,
  onClose,
  onSuccess,
}: {
  visible: boolean
  schoolId: number
  contact?: Contact
  onClose: () => void
  onSuccess: () => void
}) {
  const isEdit = !!contact
  const blankForm = () => ({
    name: contact?.name ?? '',
    phone: contact?.phone ?? '',
    email: contact?.email ?? '',
    designation: contact?.designation ?? '',
    isPrimary: contact?.isPrimary ?? false,
  })
  const [form, setForm] = useState(blankForm)
  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }))

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        designation: form.designation.trim() || undefined,
        isPrimary: form.isPrimary,
        schoolId,
      }
      return isEdit
        ? api.put(`/contacts/${contact!.id}`, payload)
        : api.post('/contacts', payload)
    },
    onSuccess: () => {
      setForm(blankForm())
      onSuccess()
    },
    onError: () => Alert.alert('Error', `Failed to ${isEdit ? 'update' : 'add'} contact.`),
  })

  const submit = () => {
    if (!form.name.trim() || !form.phone.trim()) {
      Alert.alert('Required', 'Name and Phone are required.')
      return
    }
    mutation.mutate()
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={fm.header}>
          <Text style={fm.title}>{isEdit ? 'Edit Contact' : 'Add Contact'}</Text>
          <Pressable onPress={onClose} hitSlop={8}><Text style={fm.cancel}>Cancel</Text></Pressable>
        </View>
        <ScrollView style={fm.body} keyboardShouldPersistTaps="handled">
          {[
            { key: 'name', label: 'Name *', placeholder: 'Full name', kbType: 'default' },
            { key: 'phone', label: 'Phone *', placeholder: 'Phone number', kbType: 'phone-pad' },
            { key: 'email', label: 'Email', placeholder: 'email@school.com', kbType: 'email-address' },
            { key: 'designation', label: 'Designation', placeholder: 'e.g. Principal', kbType: 'default' },
          ].map((f) => (
            <View key={f.key} style={fm.field}>
              <Text style={fm.label}>{f.label}</Text>
              <TextInput
                style={fm.input}
                placeholder={f.placeholder}
                placeholderTextColor={C.textMuted}
                value={(form as any)[f.key]}
                onChangeText={(v) => set(f.key, v)}
                keyboardType={f.kbType as any}
                autoCapitalize={f.kbType === 'email-address' ? 'none' : 'words'}
              />
            </View>
          ))}

          {/* isPrimary toggle */}
          <View style={fm.field}>
            <Pressable
              style={fm.toggleRow}
              onPress={() => set('isPrimary', !form.isPrimary)}
            >
              <View style={[fm.checkbox, form.isPrimary && fm.checkboxActive]}>
                {form.isPrimary ? <Text style={fm.checkmark}>✓</Text> : null}
              </View>
              <Text style={fm.toggleLabel}>Set as Primary Contact</Text>
            </Pressable>
          </View>

          <Pressable style={fm.submitBtn} onPress={submit} disabled={mutation.isPending}>
            {mutation.isPending
              ? <ActivityIndicator color="#fff" />
              : <Text style={fm.submitText}>{isEdit ? 'Save Changes' : 'Add Contact'}</Text>}
          </Pressable>
          <View style={{ height: 48 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ── AgreementFormModal ────────────────────────────────────────────────────────

function AgreementFormModal({
  visible,
  schoolId,
  agreement,
  onClose,
  onSuccess,
}: {
  visible: boolean
  schoolId: number
  agreement?: Agreement
  onClose: () => void
  onSuccess: () => void
}) {
  const isEdit = !!agreement
  const blankForm = () => ({
    startDate: agreement?.startDate?.slice(0, 10) ?? todayISO(),
    durationMonths: agreement ? '' : '12',
    endDate: agreement?.endDate?.slice(0, 10) ?? addMonths(todayISO(), 12),
    value: agreement ? String(agreement.value) : '',
    advancePayment: agreement ? String(agreement.advancePayment) : '0',
    totalInstalments: agreement ? String(agreement.totalInstalments) : '1',
    renewalDate: agreement?.renewalDate?.slice(0, 10) ?? '',
    notes: agreement?.notes ?? '',
  })
  const [form, setForm] = useState(blankForm)

  const set = (k: string, v: string) => {
    setForm((f) => {
      const next = { ...f, [k]: v }
      // Auto-calculate endDate when startDate or durationMonths changes
      if ((k === 'startDate' || k === 'durationMonths') && next.startDate && next.durationMonths) {
        const months = parseInt(next.durationMonths, 10)
        if (!isNaN(months) && months > 0) {
          next.endDate = addMonths(next.startDate, months)
        }
      }
      return next
    })
  }

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        schoolId,
        startDate: form.startDate,
        endDate: form.endDate,
        renewalDate: form.renewalDate || undefined,
        value: parseFloat(form.value),
        advancePayment: parseFloat(form.advancePayment) || 0,
        totalInstalments: parseInt(form.totalInstalments, 10) || 1,
        notes: form.notes.trim() || undefined,
      }
      return isEdit
        ? api.put(`/agreements/${agreement!.id}`, payload)
        : api.post('/agreements', payload)
    },
    onSuccess: () => {
      setForm(blankForm())
      onSuccess()
    },
    onError: () => Alert.alert('Error', `Failed to ${isEdit ? 'update' : 'create'} agreement.`),
  })

  const submit = () => {
    if (!form.startDate || !form.endDate || !form.value) {
      Alert.alert('Required', 'Start date, end date and value are required.')
      return
    }
    const val = parseFloat(form.value)
    if (isNaN(val) || val <= 0) {
      Alert.alert('Invalid', 'Agreement value must be a positive number.')
      return
    }
    mutation.mutate()
  }

  // Preview computed instalment
  const numVal = parseFloat(form.value) || 0
  const numAdv = parseFloat(form.advancePayment) || 0
  const numInst = parseInt(form.totalInstalments, 10) || 1
  const instalmentPreview = numInst > 0 ? Math.round((numVal - numAdv) / numInst) : 0

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={fm.header}>
          <Text style={fm.title}>{isEdit ? 'Edit Agreement' : 'New Agreement'}</Text>
          <Pressable onPress={onClose} hitSlop={8}><Text style={fm.cancel}>Cancel</Text></Pressable>
        </View>
        <ScrollView style={fm.body} keyboardShouldPersistTaps="handled">
          {/* Start Date */}
          <View style={fm.field}>
            <Text style={fm.label}>Start Date * (YYYY-MM-DD)</Text>
            <TextInput
              style={fm.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={C.textMuted}
              value={form.startDate}
              onChangeText={(v) => set('startDate', v)}
              autoCapitalize="none"
            />
          </View>

          {/* Duration months */}
          <View style={fm.field}>
            <Text style={fm.label}>Duration (months)</Text>
            <TextInput
              style={fm.input}
              placeholder="e.g. 12"
              placeholderTextColor={C.textMuted}
              value={form.durationMonths}
              onChangeText={(v) => set('durationMonths', v)}
              keyboardType="numeric"
            />
          </View>

          {/* End Date (auto-calculated, still editable) */}
          <View style={fm.field}>
            <Text style={fm.label}>End Date (auto-calculated)</Text>
            <TextInput
              style={[fm.input, { backgroundColor: C.grayLight }]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={C.textMuted}
              value={form.endDate}
              onChangeText={(v) => set('endDate', v)}
              autoCapitalize="none"
            />
          </View>

          {/* Value */}
          <View style={fm.field}>
            <Text style={fm.label}>Annual Value (₹) *</Text>
            <TextInput
              style={fm.input}
              placeholder="e.g. 150000"
              placeholderTextColor={C.textMuted}
              value={form.value}
              onChangeText={(v) => set('value', v)}
              keyboardType="numeric"
            />
          </View>

          {/* Advance Payment */}
          <View style={fm.field}>
            <Text style={fm.label}>Advance Payment (₹)</Text>
            <TextInput
              style={fm.input}
              placeholder="0"
              placeholderTextColor={C.textMuted}
              value={form.advancePayment}
              onChangeText={(v) => set('advancePayment', v)}
              keyboardType="numeric"
            />
          </View>

          {/* Total Instalments */}
          <View style={fm.field}>
            <Text style={fm.label}>Total Instalments</Text>
            <TextInput
              style={fm.input}
              placeholder="1"
              placeholderTextColor={C.textMuted}
              value={form.totalInstalments}
              onChangeText={(v) => set('totalInstalments', v)}
              keyboardType="numeric"
            />
            {numVal > 0 && numInst > 0 ? (
              <Text style={fm.helper}>
                Each instalment: {formatCurrency(instalmentPreview)}
              </Text>
            ) : null}
          </View>

          {/* Renewal Date */}
          <View style={fm.field}>
            <Text style={fm.label}>Renewal Date (optional)</Text>
            <TextInput
              style={fm.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={C.textMuted}
              value={form.renewalDate}
              onChangeText={(v) => set('renewalDate', v)}
              autoCapitalize="none"
            />
          </View>

          {/* Notes */}
          <View style={fm.field}>
            <Text style={fm.label}>Notes</Text>
            <TextInput
              style={[fm.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Optional notes"
              placeholderTextColor={C.textMuted}
              value={form.notes}
              onChangeText={(v) => set('notes', v)}
              multiline
            />
          </View>

          <Pressable style={fm.submitBtn} onPress={submit} disabled={mutation.isPending}>
            {mutation.isPending
              ? <ActivityIndicator color="#fff" />
              : <Text style={fm.submitText}>{isEdit ? 'Save Changes' : 'Create Agreement'}</Text>}
          </Pressable>
          <View style={{ height: 48 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ── QuotationFormModal ────────────────────────────────────────────────────────

function QuotationFormModal({
  visible,
  schoolId,
  totalStudents,
  defaultAddons = [],
  onClose,
  onSuccess,
}: {
  visible: boolean
  schoolId: number
  totalStudents?: number
  defaultAddons?: SchoolAddon[]
  onClose: () => void
  onSuccess: () => void
}) {
  const { data: catalog = [] } = useQuery<Addon[]>({
    queryKey: ['addons'],
    queryFn: () => api.get('/addons').then((r) => r.data),
    enabled: visible,
  })

  type LineItem = {
    addonId: number | undefined
    name: string
    type: 'ERP' | 'ADDON'
    quantity: number
    unitPrice: number
  }

  const makeItems = (): LineItem[] =>
    defaultAddons.length > 0
      ? defaultAddons.map((sa) => ({
          addonId: sa.addonId,
          name: sa.addon.name,
          type: sa.addon.category as 'ERP' | 'ADDON',
          quantity: 1,
          unitPrice: Number(sa.price),
        }))
      : [{ addonId: undefined, name: '', type: 'ADDON', quantity: 1, unitPrice: 0 }]

  const [items, setItems] = useState<LineItem[]>(makeItems)
  const [discount, setDiscount] = useState(0)
  const [tax, setTax] = useState(0)
  const [showCatalog, setShowCatalog] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const total = subtotal - discount + tax

  const applyGst = () => setTax(Math.round((subtotal - discount) * 0.18))

  const selectAddon = (rowIdx: number, addon: Addon) => {
    let price = Number(addon.price)
    if (addon.tiers && addon.tiers.length > 0 && totalStudents != null) {
      const tier = addon.tiers.find((t) => totalStudents <= t.maxStudents) ?? addon.tiers[addon.tiers.length - 1]
      price = tier.price
    }
    setItems((prev) =>
      prev.map((it, i) =>
        i === rowIdx
          ? { ...it, addonId: addon.id, name: addon.name, type: addon.category as 'ERP' | 'ADDON', unitPrice: price }
          : it,
      ),
    )
    setShowCatalog(null)
  }

  const submit = async () => {
    if (items.some((i) => !i.name.trim() || i.unitPrice <= 0)) {
      Alert.alert('Error', 'All items need a name and price.')
      return
    }
    setLoading(true)
    try {
      await api.post('/quotations', {
        schoolId,
        discount,
        tax,
        items: items.map(({ name, type, quantity, unitPrice }) => ({ name, type, quantity, unitPrice })),
      })
      setItems(makeItems())
      setDiscount(0)
      setTax(0)
      onSuccess()
    } catch {
      Alert.alert('Error', 'Failed to create quotation.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={qm.header}>
          <Text style={qm.title}>New Quotation</Text>
          <Pressable onPress={onClose} hitSlop={8}><Text style={qm.cancel}>Cancel</Text></Pressable>
        </View>
        <ScrollView style={qm.body} keyboardShouldPersistTaps="handled">
          <Text style={qm.sectionLabel}>Line Items</Text>

          {items.map((item, idx) => (
            <View key={idx} style={qm.itemCard}>
              {/* Catalog picker */}
              <Pressable
                style={qm.picker}
                onPress={() => setShowCatalog(showCatalog === idx ? null : idx)}
              >
                <Text style={item.name ? qm.pickerText : qm.pickerPlaceholder} numberOfLines={1}>
                  {item.name || 'Pick from catalog…'}
                </Text>
                <Text style={qm.chevron}>{showCatalog === idx ? '▲' : '▼'}</Text>
              </Pressable>

              {/* Dropdown */}
              {showCatalog === idx ? (
                <View style={qm.dropdown}>
                  {catalog.map((a) => {
                    let price = Number(a.price)
                    if (a.tiers && totalStudents != null) {
                      const tier = a.tiers.find((t) => totalStudents <= t.maxStudents) ?? a.tiers[a.tiers.length - 1]
                      price = tier.price
                    }
                    return (
                      <Pressable key={a.id} style={qm.dropdownItem} onPress={() => selectAddon(idx, a)}>
                        <Text style={qm.dropdownName}>{a.name}</Text>
                        <Text style={qm.dropdownPrice}>{formatCurrency(price)}</Text>
                      </Pressable>
                    )
                  })}
                  <Pressable style={qm.dropdownItem} onPress={() => setShowCatalog(null)}>
                    <Text style={{ color: C.textSecondary, fontSize: 13 }}>✎ Enter custom item</Text>
                  </Pressable>
                </View>
              ) : null}

              {/* Custom name input when not from catalog */}
              {!item.addonId ? (
                <TextInput
                  style={[qm.input, { marginTop: 6 }]}
                  value={item.name}
                  onChangeText={(v) =>
                    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, name: v } : it)))
                  }
                  placeholder="Item name"
                  placeholderTextColor={C.textMuted}
                />
              ) : null}

              {/* Qty + Price row */}
              <View style={qm.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={qm.fieldLabel}>Qty</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TextInput
                      style={[qm.input, { width: 64 }]}
                      value={String(item.quantity)}
                      onChangeText={(v) =>
                        setItems((prev) =>
                          prev.map((it, i) => (i === idx ? { ...it, quantity: parseInt(v, 10) || 1 } : it)),
                        )
                      }
                      keyboardType="numeric"
                    />
                    {totalStudents != null ? (
                      <Pressable
                        style={qm.strengthBtn}
                        onPress={() =>
                          setItems((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, quantity: totalStudents! } : it)),
                          )
                        }
                      >
                        <Text style={qm.strengthBtnText}>👥 {totalStudents}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={qm.fieldLabel}>Unit Price (₹)</Text>
                  <TextInput
                    style={qm.input}
                    value={String(item.unitPrice)}
                    onChangeText={(v) =>
                      setItems((prev) =>
                        prev.map((it, i) => (i === idx ? { ...it, unitPrice: parseFloat(v) || 0 } : it)),
                      )
                    }
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ justifyContent: 'flex-end', marginBottom: 4 }}>
                  <Text style={qm.itemTotal}>{formatCurrency(item.quantity * item.unitPrice)}</Text>
                </View>
              </View>

              {/* Remove row button */}
              {items.length > 1 ? (
                <Pressable onPress={() => setItems((prev) => prev.filter((_, i) => i !== idx))}>
                  <Text style={{ color: C.error, fontSize: 12, marginTop: 4 }}>Remove item</Text>
                </Pressable>
              ) : null}
            </View>
          ))}

          <Pressable
            style={qm.addItemBtn}
            onPress={() =>
              setItems((prev) => [
                ...prev,
                { addonId: undefined, name: '', type: 'ADDON', quantity: 1, unitPrice: 0 },
              ])
            }
          >
            <Text style={qm.addItemText}>+ Add Item</Text>
          </Pressable>

          {/* Summary */}
          <View style={qm.summary}>
            <View style={qm.summaryRow}>
              <Text style={qm.summaryLabel}>Subtotal</Text>
              <Text style={qm.summaryValue}>{formatCurrency(subtotal)}</Text>
            </View>
            <View style={qm.summaryRow}>
              <Text style={qm.summaryLabel}>Discount (₹)</Text>
              <TextInput
                style={qm.summaryInput}
                value={String(discount)}
                onChangeText={(v) => setDiscount(parseFloat(v) || 0)}
                keyboardType="numeric"
              />
            </View>
            <View style={qm.summaryRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={qm.summaryLabel}>GST / Tax (₹)</Text>
                <Pressable style={qm.gstBtn} onPress={applyGst}>
                  <Text style={qm.gstBtnText}>18%</Text>
                </Pressable>
              </View>
              <TextInput
                style={qm.summaryInput}
                value={String(tax)}
                onChangeText={(v) => setTax(parseFloat(v) || 0)}
                keyboardType="numeric"
              />
            </View>
            <View style={[qm.summaryRow, qm.totalRow]}>
              <Text style={qm.totalLabel}>Total</Text>
              <Text style={qm.totalValue}>{formatCurrency(total)}</Text>
            </View>
          </View>

          <Pressable style={qm.submitBtn} onPress={submit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={qm.submitText}>Create Quotation</Text>}
          </Pressable>
          <View style={{ height: 48 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ── ActivateAddonInline ───────────────────────────────────────────────────────

function ActivateAddonInline({
  addon,
  schoolId,
  totalStudents,
  onSuccess,
}: {
  addon: Addon
  schoolId: number
  totalStudents?: number | null
  onSuccess: () => void
}) {
  const [showForm, setShowForm] = useState(false)
  const defaultPrice = (() => {
    if (addon.tiers && addon.tiers.length > 0 && totalStudents != null) {
      const tier = addon.tiers.find((t) => totalStudents <= t.maxStudents) ?? addon.tiers[addon.tiers.length - 1]
      return String(tier.price)
    }
    return String(addon.price)
  })()
  const [price, setPrice] = useState(defaultPrice)
  const [startDate, setStartDate] = useState(todayISO())

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/schools/${schoolId}/addons`, {
        addonId: addon.id,
        price: parseFloat(price),
        startDate,
      }),
    onSuccess: () => {
      setShowForm(false)
      onSuccess()
    },
    onError: () => Alert.alert('Error', 'Failed to activate add-on.'),
  })

  if (!showForm) {
    return (
      <Pressable style={s.activateBtn} onPress={() => setShowForm(true)}>
        <Text style={s.activateBtnText}>Activate</Text>
      </Pressable>
    )
  }

  return (
    <View style={s.activateForm}>
      <TextInput
        style={s.activateInput}
        value={price}
        onChangeText={setPrice}
        keyboardType="numeric"
        placeholder="Price (₹)"
        placeholderTextColor={C.textMuted}
      />
      <TextInput
        style={s.activateInput}
        value={startDate}
        onChangeText={setStartDate}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={C.textMuted}
      />
      <Pressable style={s.activateConfirmBtn} onPress={() => mutation.mutate()} disabled={mutation.isPending}>
        <Text style={s.activateConfirmText}>{mutation.isPending ? '…' : 'Confirm'}</Text>
      </Pressable>
      <Pressable onPress={() => setShowForm(false)} hitSlop={8}>
        <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 4 }}>Cancel</Text>
      </Pressable>
    </View>
  )
}

// ── TaskFormModal ─────────────────────────────────────────────────────────────

function TaskFormModal({
  visible,
  schoolId,
  onClose,
  onSuccess,
}: {
  visible: boolean
  schoolId: number
  onClose: () => void
  onSuccess: () => void
}) {
  const TASK_TYPES = ['CALL', 'MEETING', 'REMINDER']

  const [form, setForm] = useState({
    title: '',
    type: 'CALL',
    dueDate: todayISO(),
    notes: '',
    assignedToId: '',
  })
  const [showTypePicker, setShowTypePicker] = useState(false)
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
    enabled: visible,
  })

  const [showUserPicker, setShowUserPicker] = useState(false)
  const selectedUser = users.find((u) => String(u.id) === form.assignedToId)

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/tasks', {
        title: form.title.trim(),
        type: form.type,
        dueDate: form.dueDate,
        notes: form.notes.trim() || undefined,
        assignedToId: form.assignedToId ? parseInt(form.assignedToId, 10) : undefined,
        schoolId,
      }),
    onSuccess: () => {
      setForm({ title: '', type: 'CALL', dueDate: todayISO(), notes: '', assignedToId: '' })
      onSuccess()
    },
    onError: () => Alert.alert('Error', 'Failed to create task.'),
  })

  const submit = () => {
    if (!form.title.trim() || !form.dueDate) {
      Alert.alert('Required', 'Title and due date are required.')
      return
    }
    mutation.mutate()
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={fm.header}>
          <Text style={fm.title}>Add Task</Text>
          <Pressable onPress={onClose} hitSlop={8}><Text style={fm.cancel}>Cancel</Text></Pressable>
        </View>
        <ScrollView style={fm.body} keyboardShouldPersistTaps="handled">
          {/* Title */}
          <View style={fm.field}>
            <Text style={fm.label}>Title *</Text>
            <TextInput
              style={fm.input}
              placeholder="Task description"
              placeholderTextColor={C.textMuted}
              value={form.title}
              onChangeText={(v) => set('title', v)}
              autoCapitalize="sentences"
            />
          </View>

          {/* Type picker */}
          <View style={fm.field}>
            <Text style={fm.label}>Type</Text>
            <Pressable style={fm.picker} onPress={() => setShowTypePicker((p) => !p)}>
              <Text style={fm.pickerText}>{form.type}</Text>
              <Text style={fm.chevron}>{showTypePicker ? '▲' : '▼'}</Text>
            </Pressable>
            {showTypePicker ? (
              <View style={fm.dropdown}>
                {TASK_TYPES.map((t) => (
                  <Pressable
                    key={t}
                    style={[fm.dropdownItem, t === form.type && fm.dropdownItemActive]}
                    onPress={() => { set('type', t); setShowTypePicker(false) }}
                  >
                    <Text style={[fm.dropdownText, t === form.type && { color: C.primary, fontWeight: '700' }]}>
                      {TASK_TYPE_ICONS[t]} {t}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>

          {/* Due Date */}
          <View style={fm.field}>
            <Text style={fm.label}>Due Date * (YYYY-MM-DD)</Text>
            <TextInput
              style={fm.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={C.textMuted}
              value={form.dueDate}
              onChangeText={(v) => set('dueDate', v)}
              autoCapitalize="none"
            />
          </View>

          {/* Assigned To */}
          <View style={fm.field}>
            <Text style={fm.label}>Assigned To</Text>
            <Pressable
              style={fm.picker}
              onPress={() => setShowUserPicker((p) => !p)}
            >
              <Text style={selectedUser ? fm.pickerText : fm.pickerPlaceholder}>
                {selectedUser ? selectedUser.name : 'Select user…'}
              </Text>
              <Text style={fm.chevron}>{showUserPicker ? '▲' : '▼'}</Text>
            </Pressable>
            {showUserPicker ? (
              <View style={fm.dropdown}>
                <Pressable
                  style={fm.dropdownItem}
                  onPress={() => { set('assignedToId', ''); setShowUserPicker(false) }}
                >
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
            ) : null}
          </View>

          {/* Notes */}
          <View style={fm.field}>
            <Text style={fm.label}>Notes</Text>
            <TextInput
              style={[fm.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Optional notes"
              placeholderTextColor={C.textMuted}
              value={form.notes}
              onChangeText={(v) => set('notes', v)}
              multiline
            />
          </View>

          <Pressable style={fm.submitBtn} onPress={submit} disabled={mutation.isPending}>
            {mutation.isPending
              ? <ActivityIndicator color="#fff" />
              : <Text style={fm.submitText}>Add Task</Text>}
          </Pressable>
          <View style={{ height: 48 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ── ReferralFormModal ─────────────────────────────────────────────────────────

function ReferralFormModal({
  visible,
  schoolId,
  onClose,
  onSuccess,
}: {
  visible: boolean
  schoolId: number
  onClose: () => void
  onSuccess: () => void
}) {
  const [form, setForm] = useState({
    schoolName: '',
    contactPerson: '',
    phone: '',
    email: '',
    location: '',
    totalStudents: '',
    notes: '',
    bonusType: 'FIXED' as 'FIXED' | 'PERCENTAGE',
    bonusValue: '0',
    assignedToId: null as number | null,
  })
  const [showBonusPicker, setShowBonusPicker] = useState(false)
  const [showAssigneePicker, setShowAssigneePicker] = useState(false)

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
    enabled: visible,
  })

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }))

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/schools/${schoolId}/referrals`, {
        schoolName: form.schoolName.trim(),
        contactPerson: form.contactPerson.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        location: form.location.trim() || undefined,
        totalStudents: form.totalStudents.trim() ? parseInt(form.totalStudents, 10) : undefined,
        notes: form.notes.trim() || undefined,
        bonusType: form.bonusType,
        bonusValue: parseFloat(form.bonusValue) || 0,
        assignedToId: form.assignedToId ?? undefined,
      }),
    onSuccess: () => {
      setForm({
        schoolName: '', contactPerson: '', phone: '', email: '', location: '',
        totalStudents: '', notes: '', bonusType: 'FIXED', bonusValue: '0', assignedToId: null,
      })
      onSuccess()
    },
    onError: () => Alert.alert('Error', 'Failed to add referral.'),
  })

  const submit = () => {
    if (!form.schoolName.trim() || !form.contactPerson.trim() || !form.phone.trim()) {
      Alert.alert('Required', 'School name, contact person and phone are required.')
      return
    }
    mutation.mutate()
  }

  const assignedUser = users.find((u) => u.id === form.assignedToId)
  const bonusLabel = form.bonusType === 'PERCENTAGE' ? 'Bonus Percentage (%)' : 'Bonus Amount (₹)'

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={fm.header}>
          <Text style={fm.title}>Add Referral</Text>
          <Pressable onPress={onClose} hitSlop={8}><Text style={fm.cancel}>Cancel</Text></Pressable>
        </View>
        <ScrollView style={fm.body} keyboardShouldPersistTaps="handled">
          {[
            { key: 'schoolName', label: 'Referred School Name *', placeholder: 'School name', kbType: 'default' },
            { key: 'contactPerson', label: 'Contact Person *', placeholder: 'Full name', kbType: 'default' },
            { key: 'phone', label: 'Phone *', placeholder: 'Phone number', kbType: 'phone-pad' },
            { key: 'email', label: 'Email', placeholder: 'email@school.com', kbType: 'email-address' },
            { key: 'location', label: 'Location', placeholder: 'City / Area', kbType: 'default' },
            { key: 'totalStudents', label: 'Total Students', placeholder: 'e.g. 500', kbType: 'numeric' },
            { key: 'notes', label: 'Notes', placeholder: 'Optional notes', kbType: 'default' },
          ].map((f) => (
            <View key={f.key} style={fm.field}>
              <Text style={fm.label}>{f.label}</Text>
              <TextInput
                style={fm.input}
                placeholder={f.placeholder}
                placeholderTextColor={C.textMuted}
                value={(form as any)[f.key]}
                onChangeText={(v) => set(f.key, v)}
                keyboardType={f.kbType as any}
                autoCapitalize={f.kbType === 'email-address' || f.kbType === 'numeric' ? 'none' : 'words'}
              />
            </View>
          ))}

          {/* Assign To */}
          <View style={fm.field}>
            <Text style={fm.label}>Assign To</Text>
            <Pressable
              style={[fm.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
              onPress={() => setShowAssigneePicker(true)}
            >
              <Text style={{ fontSize: 14, color: assignedUser ? C.text : C.textMuted }}>
                {assignedUser ? assignedUser.name : 'Unassigned'}
              </Text>
              <Text style={{ fontSize: 12, color: C.textMuted }}>▼</Text>
            </Pressable>
          </View>

          {/* Bonus type */}
          <View style={fm.field}>
            <Text style={fm.label}>Bonus Type</Text>
            <Pressable
              style={[fm.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
              onPress={() => setShowBonusPicker(true)}
            >
              <Text style={{ fontSize: 14, color: C.text }}>
                {form.bonusType === 'PERCENTAGE' ? 'Percentage of deal value (%)' : 'Fixed amount (₹)'}
              </Text>
              <Text style={{ fontSize: 12, color: C.textMuted }}>▼</Text>
            </Pressable>
          </View>

          {/* Bonus value */}
          <View style={fm.field}>
            <Text style={fm.label}>{bonusLabel}</Text>
            <TextInput
              style={fm.input}
              placeholder="0"
              placeholderTextColor={C.textMuted}
              value={form.bonusValue}
              onChangeText={(v) => set('bonusValue', v)}
              keyboardType="numeric"
            />
          </View>

          <Pressable style={[fm.submitBtn, { backgroundColor: C.purple }]} onPress={submit} disabled={mutation.isPending}>
            {mutation.isPending
              ? <ActivityIndicator color="#fff" />
              : <Text style={fm.submitText}>Add Referral & Create Lead</Text>}
          </Pressable>
          <View style={{ height: 48 }} />
        </ScrollView>

        {/* Bonus type picker */}
        <Modal visible={showBonusPicker} transparent animationType="fade" onRequestClose={() => setShowBonusPicker(false)}>
          <Pressable style={pickerOverlayStyle} onPress={() => setShowBonusPicker(false)}>
            <View style={pickerSheetStyle}>
              <Text style={pickerTitleStyle}>Bonus Type</Text>
              {(['FIXED', 'PERCENTAGE'] as const).map((t) => (
                <Pressable
                  key={t}
                  style={[pickerOptionStyle, form.bonusType === t && pickerOptionActiveStyle]}
                  onPress={() => { set('bonusType', t); setShowBonusPicker(false) }}
                >
                  <Text style={[pickerOptionTextStyle, form.bonusType === t && pickerOptionTextActiveStyle]}>
                    {t === 'PERCENTAGE' ? 'Percentage of deal value (%)' : 'Fixed amount (₹)'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Modal>

        {/* Assignee picker */}
        <Modal visible={showAssigneePicker} transparent animationType="fade" onRequestClose={() => setShowAssigneePicker(false)}>
          <Pressable style={pickerOverlayStyle} onPress={() => setShowAssigneePicker(false)}>
            <View style={pickerSheetStyle}>
              <Text style={pickerTitleStyle}>Assign To</Text>
              <Pressable
                style={[pickerOptionStyle, form.assignedToId === null && pickerOptionActiveStyle]}
                onPress={() => { set('assignedToId', null); setShowAssigneePicker(false) }}
              >
                <Text style={[pickerOptionTextStyle, form.assignedToId === null && pickerOptionTextActiveStyle]}>Unassigned</Text>
              </Pressable>
              {users.map((u) => (
                <Pressable
                  key={u.id}
                  style={[pickerOptionStyle, form.assignedToId === u.id && pickerOptionActiveStyle]}
                  onPress={() => { set('assignedToId', u.id); setShowAssigneePicker(false) }}
                >
                  <Text style={[pickerOptionTextStyle, form.assignedToId === u.id && pickerOptionTextActiveStyle]}>{u.name}</Text>
                  <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 1 }}>{u.role}</Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Modal>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ── Picker sheet shared styles (used by AddReferralDialog pickers) ────────────
const pickerOverlayStyle = {
  flex: 1,
  backgroundColor: 'rgba(0,0,0,0.5)',
  justifyContent: 'flex-end' as const,
}
const pickerSheetStyle = {
  backgroundColor: C.surface,
  borderTopLeftRadius: 16,
  borderTopRightRadius: 16,
  padding: 16,
  paddingBottom: 32,
  maxHeight: '70%' as const,
}
const pickerTitleStyle = { fontSize: 16, fontWeight: '700' as const, color: C.text, marginBottom: 12 }
const pickerOptionStyle = { paddingVertical: 12, paddingHorizontal: 12, borderRadius: 8, marginBottom: 2 }
const pickerOptionActiveStyle = { backgroundColor: C.primaryLight }
const pickerOptionTextStyle = { fontSize: 14, fontWeight: '500' as const, color: C.text }
const pickerOptionTextActiveStyle = { color: C.primary, fontWeight: '700' as const }

// ── Shared sub-components ─────────────────────────────────────────────────────

function InfoRow({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      {onPress ? (
        <Pressable onPress={onPress} style={{ flex: 1 }}>
          <Text style={[s.infoValue, { color: C.primary, textDecorationLine: 'underline' }]} numberOfLines={2}>
            {value}
          </Text>
        </Pressable>
      ) : (
        <Text style={s.infoValue} numberOfLines={2}>{value}</Text>
      )}
    </View>
  )
}

// ── Main Styles ───────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: C.text },
  headerSub: { fontSize: 12, color: C.textSecondary, marginTop: 2 },
  editBtn: {
    backgroundColor: C.primaryLight,
    borderRadius: 7,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#93c5fd',
  },
  editBtnText: { fontSize: 13, color: C.primary, fontWeight: '600' },

  // Tabs
  tabBar: { backgroundColor: C.surface, maxHeight: 46, borderBottomWidth: 1, borderBottomColor: C.border },
  tabBarContent: { paddingHorizontal: 8, gap: 2, alignItems: 'center' },
  tab: { paddingHorizontal: 12, paddingVertical: 12, borderRadius: 6 },
  tabActive: { backgroundColor: C.primaryLight },
  tabText: { fontSize: 12, color: C.textSecondary, fontWeight: '500' },
  tabTextActive: { color: C.primary, fontWeight: '700' },

  // General content
  content: { padding: 14 },

  // Card
  card: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardTitle: { fontSize: 13, fontWeight: '700', color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },

  // Info row
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.grayLight,
  },
  infoLabel: { fontSize: 13, color: C.textSecondary, flex: 1 },
  infoValue: { fontSize: 13, color: C.text, fontWeight: '500', flex: 1.5, textAlign: 'right' },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  statValue: { fontSize: 22, fontWeight: '800', color: C.primary },
  statLabel: { fontSize: 11, color: C.textSecondary, marginTop: 3, textAlign: 'center' },

  // New button
  newBtn: {
    backgroundColor: C.primary,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  newBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Section labels
  sectionMeta: { fontSize: 12, color: C.textSecondary, marginBottom: 10 },
  groupLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 4,
  },

  // Contact card
  contactCard: {
    backgroundColor: C.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: C.border,
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '700', color: C.primary },
  contactNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  contactName: { fontSize: 14, fontWeight: '700', color: C.text },
  primaryBadge: {
    backgroundColor: C.successLight,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  primaryBadgeText: { fontSize: 10, color: C.successText, fontWeight: '700' },
  contactDesig: { fontSize: 12, color: C.textSecondary, marginBottom: 6 },
  contactActions: { gap: 4 },
  contactActionBtn: { flexDirection: 'row', alignItems: 'center' },
  contactActionText: { fontSize: 12, color: C.primary },
  contactLine: { fontSize: 13, color: C.textSecondary },
  contactCtrl: { gap: 6 },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: C.grayLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  iconBtnText: { fontSize: 14, color: C.textSecondary },

  // Agreement card
  agreementCard: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  agreementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  agreementValue: { fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 4 },
  agreementValueSuffix: { fontSize: 14, fontWeight: '400', color: C.textSecondary },
  agreementDuration: { fontSize: 13, color: C.textSecondary, marginBottom: 6 },
  advanceText: { fontSize: 13, color: C.successText, marginBottom: 4 },
  instalmentText: { fontSize: 13, color: C.text, marginBottom: 4 },
  renewalDate: { fontSize: 12, color: C.textSecondary, marginTop: 2 },
  renewalDateUrgent: { color: C.error, fontWeight: '600' },
  agreementNotes: { fontSize: 12, color: C.textMuted, marginTop: 6, fontStyle: 'italic' },
  editSmBtn: {
    backgroundColor: C.grayLight,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: C.border,
  },
  editSmBtnText: { fontSize: 12, color: C.text, fontWeight: '600' },

  // Quotation card
  quotationCard: {
    backgroundColor: C.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  quotationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  quotationId: { fontSize: 14, fontWeight: '700', color: C.text },
  quotationMeta: { fontSize: 12, color: C.textSecondary, marginTop: 2 },
  quotationTotal: { fontSize: 15, fontWeight: '800', color: C.text, textAlign: 'right' },

  // Addon card
  addonCard: {
    backgroundColor: C.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  addonCardActive: { borderColor: '#86efac', backgroundColor: '#f0fdf4' },
  addonName: { fontSize: 14, fontWeight: '600', color: C.text },
  addonSub: { fontSize: 12, color: C.textSecondary, marginTop: 2 },
  activateBtn: {
    backgroundColor: C.primaryLight,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#93c5fd',
  },
  activateBtnText: { color: C.primary, fontSize: 12, fontWeight: '600' },
  activateForm: { alignItems: 'flex-end', gap: 4 },
  activateInput: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    padding: 6,
    fontSize: 12,
    color: C.text,
    width: 110,
    textAlign: 'right',
  },
  activateConfirmBtn: {
    backgroundColor: C.primary,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  activateConfirmText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  removeBtn: {
    backgroundColor: C.errorLight,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  removeBtnText: { color: C.error, fontSize: 12, fontWeight: '700' },

  // Task card
  taskCard: {
    backgroundColor: C.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: C.border,
    gap: 10,
  },
  taskLeft: { width: 32, alignItems: 'center', paddingTop: 2 },
  taskIcon: { fontSize: 18 },
  taskTitle: { fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 3 },
  taskDue: { fontSize: 12, color: C.textSecondary },
  taskDueOverdue: { color: C.error, fontWeight: '600' },
  taskAssigned: { fontSize: 11, color: C.textMuted, marginTop: 3 },
  completeBtn: {
    backgroundColor: C.successLight,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  completeBtnText: { fontSize: 11, color: C.successText, fontWeight: '700' },

  // Referral
  referralStats: {
    backgroundColor: C.surface,
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  referralStatItem: { flex: 1, alignItems: 'center' },
  referralStatValue: { fontSize: 22, fontWeight: '800', color: C.text },
  referralStatLabel: { fontSize: 11, color: C.textSecondary, marginTop: 3 },
  referralStatDivider: { width: 1, backgroundColor: C.border },
  referralCard: {
    backgroundColor: C.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: C.purple,
    borderWidth: 1,
    borderColor: C.border,
  },
  referralHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  referralSchool: { fontSize: 14, fontWeight: '700', color: C.text, flex: 1, marginRight: 8 },
  referralContact: { fontSize: 12, color: C.textSecondary, marginBottom: 6 },
  referralFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  referralStage: { fontSize: 12, color: C.textMuted },
  referralCommission: { fontSize: 12, color: C.successText, fontWeight: '700' },
})

// ── Form Modal Styles ─────────────────────────────────────────────────────────

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
  helper: { fontSize: 11, color: C.textSecondary, marginTop: 4 },
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
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
  },
  checkboxActive: { backgroundColor: C.primary, borderColor: C.primary },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '800' },
  toggleLabel: { fontSize: 14, color: C.text },
  submitBtn: {
    backgroundColor: C.primary,
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})

// ── Quotation Modal Styles ────────────────────────────────────────────────────

const qm = StyleSheet.create({
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
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
  itemCard: {
    backgroundColor: C.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  picker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    padding: 10,
  },
  pickerText: { fontSize: 13, color: C.text, flex: 1 },
  pickerPlaceholder: { fontSize: 13, color: C.textMuted, flex: 1 },
  chevron: { fontSize: 10, color: C.textSecondary },
  dropdown: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 200,
    overflow: 'scroll',
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.grayLight,
  },
  dropdownName: { fontSize: 13, color: C.text },
  dropdownPrice: { fontSize: 12, color: C.textSecondary },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: C.text,
  },
  itemRow: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'flex-end' },
  fieldLabel: { fontSize: 11, color: C.textSecondary, marginBottom: 4 },
  itemTotal: { fontSize: 13, fontWeight: '700', color: C.text, marginBottom: 6 },
  strengthBtn: {
    backgroundColor: C.primaryLight,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  strengthBtnText: { fontSize: 11, color: C.primary, fontWeight: '600' },
  addItemBtn: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 16,
    borderStyle: 'dashed',
  },
  addItemText: { color: C.textSecondary, fontSize: 13 },
  summary: {
    backgroundColor: C.surface,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  summaryLabel: { fontSize: 13, color: C.textSecondary },
  summaryValue: { fontSize: 13, color: C.text, fontWeight: '500' },
  summaryInput: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    padding: 6,
    fontSize: 13,
    color: C.text,
    width: 100,
    textAlign: 'right',
  },
  gstBtn: {
    backgroundColor: '#fff7ed',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  gstBtnText: { color: '#ea580c', fontSize: 11, fontWeight: '700' },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 10,
    marginTop: 4,
    marginBottom: 0,
  },
  totalLabel: { fontSize: 15, fontWeight: '700', color: C.text },
  totalValue: { fontSize: 17, fontWeight: '800', color: C.text },
  submitBtn: {
    backgroundColor: C.primary,
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})
