import { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  FlatList,
  Pressable,
  Modal,
  TextInput,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { C } from '@/lib/colors'
import { formatCurrency, formatDate, formatDateTime, getInitials, todayISO } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { ContactActions } from '@/components/shared/ContactActions'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import type {
  Lead, Contact, Task, TimelineEvent, Quotation,
  Addon, SchoolAddon, ReferralListItem, UserSummary,
} from '@lms/shared'

const TABS = ['Overview', 'Contacts', 'Quotations', 'Add-Ons', 'Timeline', 'Tasks', 'Referrals'] as const
type Tab = typeof TABS[number]

const PIPELINE_STAGES = ['NEW', 'QUALIFIED', 'DEMO', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST'] as const
type PipelineStage = typeof PIPELINE_STAGES[number]

const STAGE_LABELS: Record<string, string> = {
  NEW: 'New', QUALIFIED: 'Qualified', DEMO: 'Demo', PROPOSAL: 'Proposal',
  NEGOTIATION: 'Negotiation', CLOSED_WON: 'Closed Won', CLOSED_LOST: 'Closed Lost',
}

const TIMELINE_COLORS: Record<string, string> = {
  LEAD_CREATED: C.primary,
  LEAD_CONVERTED: C.success,
  STAGE_CHANGED: C.purple,
  REFERRAL_CREATED: C.orange,
  TASK_COMPLETED: C.success,
  TASK_ADDED: C.primary,
  QUOTATION_CREATED: C.warning,
  QUOTATION_SENT: C.primary,
  QUOTATION_ACCEPTED: C.success,
  AGREEMENT_CREATED: C.purple,
  AGREEMENT_RENEWED: C.purple,
  NOTE_ADDED: '#64748b',
  LEAD_UPDATED: '#64748b',
}

// ─── Shared Field Components ─────────────────────────────────────────────────

function Field({ label, value, onPress }: { label: string; value?: string | null; onPress?: () => void }) {
  if (!value) return null
  return (
    <View style={fd.row}>
      <Text style={fd.label}>{label}</Text>
      {onPress ? (
        <Pressable onPress={onPress}><Text style={[fd.value, fd.link]}>{value}</Text></Pressable>
      ) : (
        <Text style={fd.value}>{value}</Text>
      )}
    </View>
  )
}

// ─── Edit Lead Modal ─────────────────────────────────────────────────────────

interface EditLeadModalProps {
  visible: boolean
  lead: Lead
  onClose: () => void
}

function EditLeadModal({ visible, lead, onClose }: EditLeadModalProps) {
  const queryClient = useQueryClient()
  const [schoolName, setSchoolName] = useState(lead.schoolName)
  const [contactPerson, setContactPerson] = useState(lead.contactPerson)
  const [phone, setPhone] = useState(lead.phone)
  const [email, setEmail] = useState(lead.email ?? '')
  const [location, setLocation] = useState(lead.location ?? '')
  const [totalStudents, setTotalStudents] = useState(lead.totalStudents?.toString() ?? '')
  const [pipelineStage, setPipelineStage] = useState<string>(lead.pipelineStage)
  const [status, setStatus] = useState(lead.status)
  const [notes, setNotes] = useState(lead.notes ?? '')
  const [showStagePicker, setShowStagePicker] = useState(false)
  const [showStatusPicker, setShowStatusPicker] = useState(false)

  useEffect(() => {
    if (visible) {
      setSchoolName(lead.schoolName)
      setContactPerson(lead.contactPerson)
      setPhone(lead.phone)
      setEmail(lead.email ?? '')
      setLocation(lead.location ?? '')
      setTotalStudents(lead.totalStudents?.toString() ?? '')
      setPipelineStage(lead.pipelineStage)
      setStatus(lead.status)
      setNotes(lead.notes ?? '')
    }
  }, [visible, lead])

  const mutation = useMutation({
    mutationFn: (dto: Record<string, unknown>) =>
      api.put(`/leads/${lead.id}`, dto).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads', String(lead.id)] })
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      onClose()
    },
    onError: () => Alert.alert('Error', 'Failed to save changes.'),
  })

  function handleSubmit() {
    if (!schoolName.trim()) return Alert.alert('Validation', 'School name is required.')
    if (!contactPerson.trim()) return Alert.alert('Validation', 'Contact person is required.')
    if (!phone.trim()) return Alert.alert('Validation', 'Phone is required.')
    const dto: Record<string, unknown> = {
      schoolName: schoolName.trim(),
      contactPerson: contactPerson.trim(),
      phone: phone.trim(),
      pipelineStage,
      status,
    }
    if (email.trim()) dto.email = email.trim()
    if (location.trim()) dto.location = location.trim()
    if (totalStudents.trim()) dto.totalStudents = parseInt(totalStudents, 10)
    if (notes.trim()) dto.notes = notes.trim()
    mutation.mutate(dto)
  }

  const STATUS_OPTIONS = ['NEW', 'IN_PROGRESS', 'CONVERTED', 'LOST']

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={fm.container}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={fm.header}>
            <Text style={fm.title}>Edit Lead</Text>
            <Pressable onPress={onClose} hitSlop={8}><Text style={fm.cancelBtn}>Cancel</Text></Pressable>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={fm.body} keyboardShouldPersistTaps="handled">
            <Text style={fm.label}>School Name *</Text>
            <TextInput style={fm.input} value={schoolName} onChangeText={setSchoolName} placeholderTextColor={C.textMuted} />

            <Text style={fm.label}>Contact Person *</Text>
            <TextInput style={fm.input} value={contactPerson} onChangeText={setContactPerson} placeholderTextColor={C.textMuted} />

            <Text style={fm.label}>Phone *</Text>
            <TextInput style={fm.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholderTextColor={C.textMuted} />

            <Text style={fm.label}>Email</Text>
            <TextInput style={fm.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholderTextColor={C.textMuted} />

            <Text style={fm.label}>Location</Text>
            <TextInput style={fm.input} value={location} onChangeText={setLocation} placeholderTextColor={C.textMuted} />

            <Text style={fm.label}>Total Students</Text>
            <TextInput style={fm.input} value={totalStudents} onChangeText={setTotalStudents} keyboardType="numeric" placeholderTextColor={C.textMuted} />

            <Text style={fm.label}>Status</Text>
            <Pressable style={fm.picker} onPress={() => setShowStatusPicker(true)}>
              <Text style={fm.pickerText}>{status.replace(/_/g, ' ')}</Text>
              <Text style={fm.pickerArrow}>▼</Text>
            </Pressable>

            <Text style={fm.label}>Pipeline Stage</Text>
            <Pressable style={fm.picker} onPress={() => setShowStagePicker(true)}>
              <Text style={fm.pickerText}>{STAGE_LABELS[pipelineStage] ?? pipelineStage}</Text>
              <Text style={fm.pickerArrow}>▼</Text>
            </Pressable>

            <Text style={fm.label}>Notes</Text>
            <TextInput style={[fm.input, fm.textarea]} value={notes} onChangeText={setNotes} multiline numberOfLines={4} textAlignVertical="top" placeholderTextColor={C.textMuted} />

            <Pressable style={[fm.submit, mutation.isPending && fm.submitDisabled]} onPress={handleSubmit} disabled={mutation.isPending}>
              {mutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={fm.submitText}>Save Changes</Text>}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>

        <Modal visible={showStagePicker} transparent animationType="fade" onRequestClose={() => setShowStagePicker(false)}>
          <Pressable style={fm.overlay} onPress={() => setShowStagePicker(false)}>
            <View style={fm.pickerSheet}>
              <Text style={fm.pickerTitle}>Select Stage</Text>
              {PIPELINE_STAGES.map((s) => (
                <Pressable key={s} style={[fm.pickerOpt, pipelineStage === s && fm.pickerOptActive]} onPress={() => { setPipelineStage(s); setShowStagePicker(false) }}>
                  <Text style={[fm.pickerOptText, pipelineStage === s && fm.pickerOptActiveText]}>{STAGE_LABELS[s]}</Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Modal>

        <Modal visible={showStatusPicker} transparent animationType="fade" onRequestClose={() => setShowStatusPicker(false)}>
          <Pressable style={fm.overlay} onPress={() => setShowStatusPicker(false)}>
            <View style={fm.pickerSheet}>
              <Text style={fm.pickerTitle}>Select Status</Text>
              {STATUS_OPTIONS.map((s) => (
                <Pressable key={s} style={[fm.pickerOpt, status === s && fm.pickerOptActive]} onPress={() => { setStatus(s as Lead['status']); setShowStatusPicker(false) }}>
                  <Text style={[fm.pickerOptText, status === s && fm.pickerOptActiveText]}>{s.replace(/_/g, ' ')}</Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </Modal>
  )
}

// ─── TAB 2: Contacts ─────────────────────────────────────────────────────────

interface ContactFormModalProps {
  visible: boolean
  leadId: number
  contact?: Contact
  onClose: () => void
}

function ContactFormModal({ visible, leadId, contact, onClose }: ContactFormModalProps) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(contact?.name ?? '')
  const [phone, setPhone] = useState(contact?.phone ?? '')
  const [email, setEmail] = useState(contact?.email ?? '')
  const [designation, setDesignation] = useState(contact?.designation ?? '')
  const [isPrimary, setIsPrimary] = useState(contact?.isPrimary ?? false)

  useEffect(() => {
    if (visible) {
      setName(contact?.name ?? '')
      setPhone(contact?.phone ?? '')
      setEmail(contact?.email ?? '')
      setDesignation(contact?.designation ?? '')
      setIsPrimary(contact?.isPrimary ?? false)
    }
  }, [visible, contact])

  const mutation = useMutation({
    mutationFn: (dto: Record<string, unknown>) =>
      contact
        ? api.put(`/contacts/${contact.id}`, dto).then((r) => r.data)
        : api.post('/contacts', dto).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', 'lead', leadId] })
      onClose()
    },
    onError: () => Alert.alert('Error', 'Failed to save contact.'),
  })

  function handleSubmit() {
    if (!name.trim()) return Alert.alert('Validation', 'Name is required.')
    if (!phone.trim()) return Alert.alert('Validation', 'Phone is required.')
    const dto: Record<string, unknown> = { name: name.trim(), phone: phone.trim(), isPrimary, leadId }
    if (email.trim()) dto.email = email.trim()
    if (designation.trim()) dto.designation = designation.trim()
    mutation.mutate(dto)
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={fm.container}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={fm.header}>
            <Text style={fm.title}>{contact ? 'Edit Contact' : 'Add Contact'}</Text>
            <Pressable onPress={onClose} hitSlop={8}><Text style={fm.cancelBtn}>Cancel</Text></Pressable>
          </View>
          <ScrollView contentContainerStyle={fm.body} keyboardShouldPersistTaps="handled">
            <Text style={fm.label}>Name *</Text>
            <TextInput style={fm.input} value={name} onChangeText={setName} placeholderTextColor={C.textMuted} placeholder="Full name" />

            <Text style={fm.label}>Phone *</Text>
            <TextInput style={fm.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholderTextColor={C.textMuted} placeholder="Phone number" />

            <Text style={fm.label}>Email</Text>
            <TextInput style={fm.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholderTextColor={C.textMuted} placeholder="Email address" />

            <Text style={fm.label}>Designation</Text>
            <TextInput style={fm.input} value={designation} onChangeText={setDesignation} placeholderTextColor={C.textMuted} placeholder="e.g. Principal" />

            <Pressable style={fm.toggle} onPress={() => setIsPrimary((v) => !v)}>
              <View style={[fm.toggleBox, isPrimary && fm.toggleBoxOn]}>
                {isPrimary && <Text style={fm.toggleTick}>✓</Text>}
              </View>
              <Text style={fm.toggleLabel}>Primary Contact</Text>
            </Pressable>

            <Pressable style={[fm.submit, mutation.isPending && fm.submitDisabled]} onPress={handleSubmit} disabled={mutation.isPending}>
              {mutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={fm.submitText}>{contact ? 'Save Changes' : 'Add Contact'}</Text>}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  )
}

function ContactsTab({ lead }: { lead: Lead }) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editContact, setEditContact] = useState<Contact | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null)

  const { data: contacts = [], isLoading } = useQuery<Contact[]>({
    queryKey: ['contacts', 'lead', lead.id],
    queryFn: () => api.get(`/contacts/lead/${lead.id}`).then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/contacts/${id}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', 'lead', lead.id] })
      setDeleteTarget(null)
    },
    onError: () => Alert.alert('Error', 'Failed to delete contact.'),
  })

  if (isLoading) return <LoadingSpinner />

  return (
    <View style={{ flex: 1 }}>
      <View style={tab.actionRow}>
        <Pressable style={tab.addBtn} onPress={() => { setEditContact(undefined); setShowForm(true) }}>
          <Text style={tab.addBtnText}>+ Add Contact</Text>
        </Pressable>
      </View>
      {contacts.length === 0 ? (
        <EmptyState title="No contacts yet" subtitle="Add a contact for this lead" />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
          {contacts.map((c) => (
            <View key={c.id} style={cont.card}>
              <View style={cont.avatar}>
                <Text style={cont.avatarText}>{getInitials(c.name)}</Text>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={cont.name}>{c.name}</Text>
                  {c.isPrimary && (
                    <View style={cont.primaryBadge}>
                      <Text style={cont.primaryText}>★ Primary</Text>
                    </View>
                  )}
                </View>
                {c.designation && <Text style={cont.designation}>{c.designation}</Text>}
                <Text style={cont.phone}>{c.phone}</Text>
                {c.email && <Text style={cont.email}>{c.email}</Text>}
                <View style={{ marginTop: 4 }}>
                  <ContactActions phone={c.phone} email={c.email ?? undefined} size="sm" />
                </View>
              </View>
              <View style={cont.actions}>
                <Pressable style={cont.actionBtn} onPress={() => { setEditContact(c); setShowForm(true) }}>
                  <Text style={cont.actionIcon}>✏️</Text>
                </Pressable>
                <Pressable style={cont.actionBtn} onPress={() => setDeleteTarget(c)}>
                  <Text style={cont.actionIcon}>🗑️</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <ContactFormModal
        visible={showForm}
        leadId={lead.id}
        contact={editContact}
        onClose={() => setShowForm(false)}
      />

      <ConfirmModal
        visible={deleteTarget !== null}
        title="Delete Contact"
        message={`Remove ${deleteTarget?.name} from contacts?`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </View>
  )
}

// ─── TAB 3: Quotations ───────────────────────────────────────────────────────

interface QuotationFormItem {
  id: string
  name: string
  type: 'ERP' | 'ADDON'
  quantity: string
  unitPrice: string
}

interface QuotationFormModalProps {
  visible: boolean
  lead: Lead
  onClose: () => void
}

function QuotationFormModal({ visible, lead, onClose }: QuotationFormModalProps) {
  const queryClient = useQueryClient()
  const [items, setItems] = useState<QuotationFormItem[]>([
    { id: '1', name: '', type: 'ERP', quantity: '1', unitPrice: '' },
  ])
  const [discount, setDiscount] = useState('0')
  const [tax, setTax] = useState('18')
  const [showCatalogFor, setShowCatalogFor] = useState<string | null>(null)

  const { data: addons = [] } = useQuery<Addon[]>({
    queryKey: ['addons'],
    queryFn: () => api.get('/addons').then((r) => r.data),
    enabled: visible,
  })

  useEffect(() => {
    if (visible) {
      setItems([{ id: '1', name: '', type: 'ERP', quantity: '1', unitPrice: '' }])
      setDiscount('0')
      setTax('18')
    }
  }, [visible])

  function updateItem(id: string, field: keyof QuotationFormItem, value: string) {
    setItems((prev) => prev.map((it) => it.id === id ? { ...it, [field]: value } : it))
  }

  function addItem() {
    setItems((prev) => [...prev, { id: String(Date.now()), name: '', type: 'ADDON', quantity: '1', unitPrice: '' }])
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }

  function pickAddon(itemId: string, addon: Addon) {
    let price = addon.price
    if (addon.tiers && addon.tiers.length > 0 && lead.totalStudents) {
      const sorted = [...addon.tiers].sort((a, b) => a.maxStudents - b.maxStudents)
      const matched = sorted.find((t) => lead.totalStudents! <= t.maxStudents)
      if (matched) price = matched.price
    }
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? { ...it, name: addon.name, type: addon.category, unitPrice: String(price) }
          : it
      )
    )
    setShowCatalogFor(null)
  }

  function setStrength(itemId: string) {
    if (!lead.totalStudents) return Alert.alert('Info', 'No student count on this lead.')
    setItems((prev) => prev.map((it) => it.id === itemId ? { ...it, quantity: String(lead.totalStudents) } : it))
  }

  const subtotal = items.reduce((sum, it) => {
    const qty = parseFloat(it.quantity) || 0
    const price = parseFloat(it.unitPrice) || 0
    return sum + qty * price
  }, 0)
  const discountAmt = (subtotal * (parseFloat(discount) || 0)) / 100
  const taxAmt = ((subtotal - discountAmt) * (parseFloat(tax) || 0)) / 100
  const total = subtotal - discountAmt + taxAmt

  const mutation = useMutation({
    mutationFn: (dto: Record<string, unknown>) =>
      api.post('/quotations', dto).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations', lead.id] })
      onClose()
    },
    onError: () => Alert.alert('Error', 'Failed to create quotation.'),
  })

  function handleSubmit() {
    for (const it of items) {
      if (!it.name.trim()) return Alert.alert('Validation', 'All items need a name.')
      if (!it.unitPrice.trim() || isNaN(parseFloat(it.unitPrice))) return Alert.alert('Validation', 'All items need a unit price.')
    }
    const dto = {
      leadId: lead.id,
      discount: parseFloat(discount) || 0,
      tax: parseFloat(tax) || 0,
      items: items.map((it) => ({
        name: it.name.trim(),
        type: it.type,
        quantity: parseInt(it.quantity, 10) || 1,
        unitPrice: parseFloat(it.unitPrice),
      })),
    }
    mutation.mutate(dto)
  }

  const catalogForItem = showCatalogFor ? items.find((i) => i.id === showCatalogFor) : null

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={fm.container}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={fm.header}>
            <Text style={fm.title}>New Quotation</Text>
            <Pressable onPress={onClose} hitSlop={8}><Text style={fm.cancelBtn}>Cancel</Text></Pressable>
          </View>
          <ScrollView contentContainerStyle={fm.body} keyboardShouldPersistTaps="handled">
            <Text style={qf.sectionTitle}>Line Items</Text>
            {items.map((it, idx) => (
              <View key={it.id} style={qf.itemCard}>
                <View style={qf.itemHeader}>
                  <Text style={qf.itemIdx}>Item {idx + 1}</Text>
                  <Pressable onPress={() => removeItem(it.id)} disabled={items.length === 1}>
                    <Text style={[qf.removeBtn, items.length === 1 && { opacity: 0.3 }]}>✕</Text>
                  </Pressable>
                </View>
                <View style={qf.nameRow}>
                  <TextInput
                    style={[fm.input, { flex: 1 }]}
                    value={it.name}
                    onChangeText={(v) => updateItem(it.id, 'name', v)}
                    placeholder="Item name"
                    placeholderTextColor={C.textMuted}
                  />
                  <Pressable style={qf.catalogBtn} onPress={() => setShowCatalogFor(it.id)}>
                    <Text style={qf.catalogBtnText}>Catalog</Text>
                  </Pressable>
                </View>
                <View style={qf.typeRow}>
                  {(['ERP', 'ADDON'] as const).map((t) => (
                    <Pressable
                      key={t}
                      style={[qf.typeBtn, it.type === t && qf.typeBtnActive]}
                      onPress={() => updateItem(it.id, 'type', t)}
                    >
                      <Text style={[qf.typeBtnText, it.type === t && qf.typeBtnActiveText]}>{t}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={qf.priceRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={fm.label}>Quantity</Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TextInput
                        style={[fm.input, { flex: 1 }]}
                        value={it.quantity}
                        onChangeText={(v) => updateItem(it.id, 'quantity', v)}
                        keyboardType="numeric"
                        placeholderTextColor={C.textMuted}
                      />
                      <Pressable style={qf.strengthBtn} onPress={() => setStrength(it.id)}>
                        <Text style={qf.strengthBtnText}>Strength</Text>
                      </Pressable>
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={fm.label}>Unit Price</Text>
                    <TextInput
                      style={fm.input}
                      value={it.unitPrice}
                      onChangeText={(v) => updateItem(it.id, 'unitPrice', v)}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={C.textMuted}
                    />
                  </View>
                </View>
                <Text style={qf.lineTotal}>
                  Total: {formatCurrency((parseFloat(it.quantity) || 0) * (parseFloat(it.unitPrice) || 0))}
                </Text>
              </View>
            ))}

            <Pressable style={qf.addItemBtn} onPress={addItem}>
              <Text style={qf.addItemBtnText}>+ Add Item</Text>
            </Pressable>

            <Text style={qf.sectionTitle}>Pricing</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={fm.label}>Discount %</Text>
                <TextInput style={fm.input} value={discount} onChangeText={setDiscount} keyboardType="decimal-pad" placeholderTextColor={C.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={fm.label}>Tax %</Text>
                <TextInput style={fm.input} value={tax} onChangeText={setTax} keyboardType="decimal-pad" placeholderTextColor={C.textMuted} />
              </View>
            </View>

            <View style={qf.summaryCard}>
              <View style={qf.summaryRow}>
                <Text style={qf.summaryLabel}>Subtotal</Text>
                <Text style={qf.summaryValue}>{formatCurrency(subtotal)}</Text>
              </View>
              <View style={qf.summaryRow}>
                <Text style={qf.summaryLabel}>Discount ({discount}%)</Text>
                <Text style={[qf.summaryValue, { color: C.error }]}>-{formatCurrency((subtotal * (parseFloat(discount) || 0)) / 100)}</Text>
              </View>
              <View style={qf.summaryRow}>
                <Text style={qf.summaryLabel}>Tax ({tax}%)</Text>
                <Text style={qf.summaryValue}>{formatCurrency(((subtotal - (subtotal * (parseFloat(discount) || 0)) / 100) * (parseFloat(tax) || 0)) / 100)}</Text>
              </View>
              <View style={[qf.summaryRow, qf.summaryTotalRow]}>
                <Text style={qf.summaryTotalLabel}>Total</Text>
                <Text style={qf.summaryTotalValue}>{formatCurrency(total)}</Text>
              </View>
            </View>

            <Pressable style={[fm.submit, mutation.isPending && fm.submitDisabled]} onPress={handleSubmit} disabled={mutation.isPending}>
              {mutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={fm.submitText}>Create Quotation</Text>}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Catalog Picker */}
        <Modal visible={showCatalogFor !== null} transparent animationType="fade" onRequestClose={() => setShowCatalogFor(null)}>
          <Pressable style={fm.overlay} onPress={() => setShowCatalogFor(null)}>
            <View style={[fm.pickerSheet, { maxHeight: '80%' }]}>
              <Text style={fm.pickerTitle}>Select from Catalog</Text>
              <ScrollView>
                {addons.map((addon) => (
                  <Pressable
                    key={addon.id}
                    style={cat.item}
                    onPress={() => showCatalogFor && pickAddon(showCatalogFor, addon)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={cat.itemName}>{addon.name}</Text>
                      <Text style={cat.itemCat}>{addon.category}</Text>
                      {addon.description && <Text style={cat.itemDesc} numberOfLines={1}>{addon.description}</Text>}
                    </View>
                    <Text style={cat.itemPrice}>{formatCurrency(addon.price)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </Modal>
  )
}

function QuotationsTab({ lead }: { lead: Lead }) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)

  const { data: quotations = [], isLoading } = useQuery<Quotation[]>({
    queryKey: ['quotations', lead.id],
    queryFn: () => api.get('/quotations', { params: { leadId: lead.id } }).then((r) => r.data),
  })

  if (isLoading) return <LoadingSpinner />

  return (
    <View style={{ flex: 1 }}>
      <View style={tab.actionRow}>
        <Pressable style={tab.addBtn} onPress={() => setShowForm(true)}>
          <Text style={tab.addBtnText}>+ New Quotation</Text>
        </Pressable>
      </View>
      {quotations.length === 0 ? (
        <EmptyState title="No quotations yet" subtitle="Create your first quotation" />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
          {quotations.map((q) => (
            <Pressable
              key={q.id}
              style={qt.card}
              onPress={() => router.push(`/(app)/quotations/${q.id}`)}
            >
              <View style={qt.row}>
                <Text style={qt.id}>Quotation #{q.id}</Text>
                <StatusBadge status={q.status} size="sm" />
              </View>
              <View style={qt.row}>
                <Text style={qt.meta}>{q.items.length} items · {formatDate(q.createdAt)}</Text>
                <Text style={qt.total}>{formatCurrency(q.total)}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
      <QuotationFormModal visible={showForm} lead={lead} onClose={() => setShowForm(false)} />
    </View>
  )
}

// ─── TAB 4: Add-Ons ──────────────────────────────────────────────────────────

interface AddAddonModalProps {
  visible: boolean
  leadId: number
  addon: Addon
  onClose: () => void
}

function AddAddonModal({ visible, leadId, addon, onClose }: AddAddonModalProps) {
  const queryClient = useQueryClient()
  const [price, setPrice] = useState(String(addon.price))
  const [startDate, setStartDate] = useState(todayISO())

  useEffect(() => {
    if (visible) {
      setPrice(String(addon.price))
      setStartDate(todayISO())
    }
  }, [visible, addon])

  const mutation = useMutation({
    mutationFn: (dto: { addonId: number; price: number; startDate: string }) =>
      api.post(`/leads/${leadId}/addons`, dto).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-addons', leadId] })
      onClose()
    },
    onError: () => Alert.alert('Error', 'Failed to add add-on.'),
  })

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={fm.overlay} onPress={onClose}>
        <View style={[fm.pickerSheet, { paddingBottom: 40 }]}>
          <Text style={fm.pickerTitle}>Add: {addon.name}</Text>
          <Text style={fm.label}>Price (₹)</Text>
          <TextInput
            style={fm.input}
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
            placeholderTextColor={C.textMuted}
          />
          <Text style={fm.label}>Start Date (YYYY-MM-DD)</Text>
          <TextInput
            style={fm.input}
            value={startDate}
            onChangeText={setStartDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={C.textMuted}
          />
          <Pressable
            style={[fm.submit, mutation.isPending && fm.submitDisabled]}
            onPress={() => mutation.mutate({ addonId: addon.id, price: parseFloat(price) || addon.price, startDate })}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={fm.submitText}>Add Add-On</Text>}
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  )
}

function AddOnsTab({ lead }: { lead: Lead }) {
  const queryClient = useQueryClient()
  const [addTarget, setAddTarget] = useState<Addon | null>(null)
  const [removeTarget, setRemoveTarget] = useState<SchoolAddon | null>(null)

  const { data: catalog = [], isLoading: catalogLoading } = useQuery<Addon[]>({
    queryKey: ['addons'],
    queryFn: () => api.get('/addons').then((r) => r.data),
  })

  const { data: active = [], isLoading: activeLoading } = useQuery<SchoolAddon[]>({
    queryKey: ['lead-addons', lead.id],
    queryFn: () => api.get(`/leads/${lead.id}/addons`).then((r) => r.data),
  })

  const removeMutation = useMutation({
    mutationFn: (addonId: number) =>
      api.delete(`/leads/${lead.id}/addons/${addonId}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-addons', lead.id] })
      setRemoveTarget(null)
    },
    onError: () => Alert.alert('Error', 'Failed to remove add-on.'),
  })

  if (catalogLoading || activeLoading) return <LoadingSpinner />

  const activeMap = new Map(active.map((a) => [a.addonId, a]))
  const erpAddons = catalog.filter((a) => a.category === 'ERP')
  const addonAddons = catalog.filter((a) => a.category === 'ADDON')

  function renderAddon(addon: Addon) {
    const activeEntry = activeMap.get(addon.id)
    return (
      <View key={addon.id} style={ao.card}>
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={ao.name}>{addon.name}</Text>
            {activeEntry && (
              <View style={ao.activeBadge}>
                <Text style={ao.activeText}>Active</Text>
              </View>
            )}
          </View>
          {addon.description && <Text style={ao.desc} numberOfLines={2}>{addon.description}</Text>}
          <Text style={ao.price}>
            {activeEntry ? formatCurrency(activeEntry.price) : formatCurrency(addon.price)}
            {activeEntry && <Text style={ao.startDate}> · from {formatDate(activeEntry.startDate)}</Text>}
          </Text>
        </View>
        {activeEntry ? (
          <Pressable style={ao.removeBtn} onPress={() => setRemoveTarget(activeEntry)}>
            <Text style={ao.removeBtnText}>Remove</Text>
          </Pressable>
        ) : (
          <Pressable style={ao.addBtn} onPress={() => setAddTarget(addon)}>
            <Text style={ao.addBtnText}>Add</Text>
          </Pressable>
        )}
      </View>
    )
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      {erpAddons.length > 0 && (
        <View>
          <Text style={ao.sectionTitle}>ERP</Text>
          <View style={{ gap: 8 }}>{erpAddons.map(renderAddon)}</View>
        </View>
      )}
      {addonAddons.length > 0 && (
        <View>
          <Text style={ao.sectionTitle}>Add-Ons</Text>
          <View style={{ gap: 8 }}>{addonAddons.map(renderAddon)}</View>
        </View>
      )}
      {catalog.length === 0 && <EmptyState title="No add-ons in catalog" />}

      {addTarget && (
        <AddAddonModal
          visible={addTarget !== null}
          leadId={lead.id}
          addon={addTarget}
          onClose={() => setAddTarget(null)}
        />
      )}

      <ConfirmModal
        visible={removeTarget !== null}
        title="Remove Add-On"
        message={`Remove ${removeTarget?.addon.name} from this lead?`}
        confirmLabel="Remove"
        destructive
        onConfirm={() => removeTarget && removeMutation.mutate(removeTarget.addonId)}
        onCancel={() => setRemoveTarget(null)}
      />
    </ScrollView>
  )
}

// ─── TAB 5: Timeline ─────────────────────────────────────────────────────────

function TimelineTab({ lead }: { lead: Lead }) {
  const { data: events = [], isLoading } = useQuery<TimelineEvent[]>({
    queryKey: ['timeline', lead.id],
    queryFn: () => api.get(`/leads/${lead.id}/timeline`).then((r) => r.data),
  })

  if (isLoading) return <LoadingSpinner />
  if (events.length === 0) return <EmptyState title="No timeline events" />

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      {events.map((ev, idx) => {
        const color = TIMELINE_COLORS[ev.eventType] ?? '#64748b'
        return (
          <View key={ev.id} style={tl.row}>
            <View style={tl.leftCol}>
              <View style={[tl.dot, { backgroundColor: color }]} />
              {idx < events.length - 1 && <View style={tl.line} />}
            </View>
            <View style={tl.content}>
              <Text style={tl.desc}>{ev.description}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <StatusBadge status={ev.eventType} size="sm" />
                <Text style={tl.meta}>
                  {formatDateTime(ev.createdAt)}
                  {ev.createdBy ? ` · ${ev.createdBy.name}` : ''}
                </Text>
              </View>
            </View>
          </View>
        )
      })}
    </ScrollView>
  )
}

// ─── TAB 6: Tasks ────────────────────────────────────────────────────────────

const TASK_TYPE_ICONS: Record<string, string> = {
  CALL: '📞', MEETING: '👥', REMINDER: '🔔',
}

interface TaskFormModalProps {
  visible: boolean
  leadId: number
  onClose: () => void
}

function TaskFormModal({ visible, leadId, onClose }: TaskFormModalProps) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [type, setType] = useState<'CALL' | 'MEETING' | 'REMINDER'>('CALL')
  const [dueDate, setDueDate] = useState(todayISO())
  const [assignedToId, setAssignedToId] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [showUserPicker, setShowUserPicker] = useState(false)

  const { data: users = [] } = useQuery<UserSummary[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
    enabled: visible,
  })

  useEffect(() => {
    if (visible) {
      setTitle(''); setType('CALL'); setDueDate(todayISO())
      setAssignedToId(null); setNotes('')
    }
  }, [visible])

  const mutation = useMutation({
    mutationFn: (dto: Record<string, unknown>) => api.post('/tasks', dto).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', leadId] })
      onClose()
    },
    onError: () => Alert.alert('Error', 'Failed to create task.'),
  })

  function handleSubmit() {
    if (!title.trim()) return Alert.alert('Validation', 'Title is required.')
    if (!dueDate.trim()) return Alert.alert('Validation', 'Due date is required.')
    const dto: Record<string, unknown> = { title: title.trim(), type, dueDate, leadId }
    if (assignedToId) dto.assignedToId = assignedToId
    if (notes.trim()) dto.notes = notes.trim()
    mutation.mutate(dto)
  }

  const assignedUser = users.find((u) => u.id === assignedToId)

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={fm.container}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={fm.header}>
            <Text style={fm.title}>Add Task</Text>
            <Pressable onPress={onClose} hitSlop={8}><Text style={fm.cancelBtn}>Cancel</Text></Pressable>
          </View>
          <ScrollView contentContainerStyle={fm.body} keyboardShouldPersistTaps="handled">
            <Text style={fm.label}>Title *</Text>
            <TextInput style={fm.input} value={title} onChangeText={setTitle} placeholder="Task title" placeholderTextColor={C.textMuted} />

            <Text style={fm.label}>Type</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['CALL', 'MEETING', 'REMINDER'] as const).map((t) => (
                <Pressable
                  key={t}
                  style={[tkf.typeBtn, type === t && tkf.typeBtnActive]}
                  onPress={() => setType(t)}
                >
                  <Text style={[tkf.typeBtnText, type === t && tkf.typeBtnActiveText]}>
                    {TASK_TYPE_ICONS[t]} {t}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={fm.label}>Due Date (YYYY-MM-DD)</Text>
            <TextInput style={fm.input} value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" placeholderTextColor={C.textMuted} />

            <Text style={fm.label}>Assign To</Text>
            <Pressable style={fm.picker} onPress={() => setShowUserPicker(true)}>
              <Text style={fm.pickerText}>{assignedUser ? assignedUser.name : 'Unassigned'}</Text>
              <Text style={fm.pickerArrow}>▼</Text>
            </Pressable>

            <Text style={fm.label}>Notes</Text>
            <TextInput style={[fm.input, fm.textarea]} value={notes} onChangeText={setNotes} multiline numberOfLines={3} textAlignVertical="top" placeholderTextColor={C.textMuted} placeholder="Additional notes..." />

            <Pressable style={[fm.submit, mutation.isPending && fm.submitDisabled]} onPress={handleSubmit} disabled={mutation.isPending}>
              {mutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={fm.submitText}>Create Task</Text>}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>

        <Modal visible={showUserPicker} transparent animationType="fade" onRequestClose={() => setShowUserPicker(false)}>
          <Pressable style={fm.overlay} onPress={() => setShowUserPicker(false)}>
            <View style={fm.pickerSheet}>
              <Text style={fm.pickerTitle}>Assign To</Text>
              <Pressable style={[fm.pickerOpt, assignedToId === null && fm.pickerOptActive]} onPress={() => { setAssignedToId(null); setShowUserPicker(false) }}>
                <Text style={[fm.pickerOptText, assignedToId === null && fm.pickerOptActiveText]}>Unassigned</Text>
              </Pressable>
              {users.map((u) => (
                <Pressable key={u.id} style={[fm.pickerOpt, assignedToId === u.id && fm.pickerOptActive]} onPress={() => { setAssignedToId(u.id); setShowUserPicker(false) }}>
                  <Text style={[fm.pickerOptText, assignedToId === u.id && fm.pickerOptActiveText]}>{u.name}</Text>
                  <Text style={fm.pickerOptSub}>{u.role}</Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </Modal>
  )
}

function TasksTab({ lead }: { lead: Lead }) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ['tasks', lead.id],
    queryFn: () => api.get('/tasks', { params: { leadId: lead.id } }).then((r) => r.data),
  })

  const completeMutation = useMutation({
    mutationFn: (id: number) => api.put(`/tasks/${id}`, { status: 'COMPLETED' }).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', lead.id] }),
    onError: () => Alert.alert('Error', 'Failed to complete task.'),
  })

  if (isLoading) return <LoadingSpinner />

  return (
    <View style={{ flex: 1 }}>
      <View style={tab.actionRow}>
        <Pressable style={tab.addBtn} onPress={() => setShowForm(true)}>
          <Text style={tab.addBtnText}>+ Add Task</Text>
        </Pressable>
      </View>
      {tasks.length === 0 ? (
        <EmptyState title="No tasks" subtitle="Add a task for follow-up" />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
          {tasks.map((task) => (
            <View key={task.id} style={tk.card}>
              <View style={tk.icon}>
                <Text style={tk.iconText}>{TASK_TYPE_ICONS[task.type] ?? '📋'}</Text>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={tk.title}>{task.title}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={tk.due}>Due: {formatDate(task.dueDate)}</Text>
                  <StatusBadge status={task.status} size="sm" />
                </View>
                {task.assignedTo && <Text style={tk.assigned}>{task.assignedTo.name}</Text>}
                {task.notes && <Text style={tk.notes} numberOfLines={2}>{task.notes}</Text>}
              </View>
              {task.status === 'PENDING' && (
                <Pressable
                  style={tk.checkBtn}
                  onPress={() => completeMutation.mutate(task.id)}
                  disabled={completeMutation.isPending}
                >
                  <Text style={tk.checkIcon}>✓</Text>
                </Pressable>
              )}
            </View>
          ))}
        </ScrollView>
      )}
      <TaskFormModal visible={showForm} leadId={lead.id} onClose={() => setShowForm(false)} />
    </View>
  )
}

// ─── TAB 7: Referrals ────────────────────────────────────────────────────────

interface ReferralFormModalProps {
  visible: boolean
  leadId: number
  onClose: () => void
}

function ReferralFormModal({ visible, leadId, onClose }: ReferralFormModalProps) {
  const queryClient = useQueryClient()
  const [schoolName, setSchoolName] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [location, setLocation] = useState('')
  const [totalStudents, setTotalStudents] = useState('')
  const [notes, setNotes] = useState('')
  const [bonusType, setBonusType] = useState<'FIXED' | 'PERCENTAGE'>('FIXED')
  const [bonusValue, setBonusValue] = useState('')
  const [assignedToId, setAssignedToId] = useState<number | null>(null)
  const [showBonusPicker, setShowBonusPicker] = useState(false)
  const [showAssignPicker, setShowAssignPicker] = useState(false)

  const { data: users = [] } = useQuery<UserSummary[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
    enabled: visible,
  })

  useEffect(() => {
    if (visible) {
      setSchoolName(''); setContactPerson(''); setPhone('')
      setEmail(''); setLocation(''); setTotalStudents(''); setNotes('')
      setBonusType('FIXED'); setBonusValue(''); setAssignedToId(null)
    }
  }, [visible])

  const mutation = useMutation({
    mutationFn: (dto: Record<string, unknown>) =>
      api.post(`/leads/${leadId}/referrals`, dto).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referrals', leadId] })
      onClose()
    },
    onError: () => Alert.alert('Error', 'Failed to create referral.'),
  })

  function handleSubmit() {
    if (!schoolName.trim()) return Alert.alert('Validation', 'School name is required.')
    if (!contactPerson.trim()) return Alert.alert('Validation', 'Contact person is required.')
    if (!phone.trim()) return Alert.alert('Validation', 'Phone is required.')
    const dto: Record<string, unknown> = {
      schoolName: schoolName.trim(),
      contactPerson: contactPerson.trim(),
      phone: phone.trim(),
      bonusType,
      bonusValue: parseFloat(bonusValue) || 0,
    }
    if (email.trim()) dto.email = email.trim()
    if (location.trim()) dto.location = location.trim()
    if (totalStudents.trim()) dto.totalStudents = parseInt(totalStudents, 10)
    if (notes.trim()) dto.notes = notes.trim()
    if (assignedToId) dto.assignedToId = assignedToId
    mutation.mutate(dto)
  }

  const assignedUser = users.find((u) => u.id === assignedToId)
  const bonusLabel = bonusType === 'PERCENTAGE' ? 'Bonus Percentage (%)' : 'Bonus Amount (₹)'

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={fm.container}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={fm.header}>
            <Text style={fm.title}>Add Referral</Text>
            <Pressable onPress={onClose} hitSlop={8}><Text style={fm.cancelBtn}>Cancel</Text></Pressable>
          </View>
          <ScrollView contentContainerStyle={fm.body} keyboardShouldPersistTaps="handled">
            <Text style={fm.label}>School Name *</Text>
            <TextInput style={fm.input} value={schoolName} onChangeText={setSchoolName} placeholder="Referred school name" placeholderTextColor={C.textMuted} />

            <Text style={fm.label}>Contact Person *</Text>
            <TextInput style={fm.input} value={contactPerson} onChangeText={setContactPerson} placeholder="Contact person" placeholderTextColor={C.textMuted} />

            <Text style={fm.label}>Phone *</Text>
            <TextInput style={fm.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="Phone number" placeholderTextColor={C.textMuted} />

            <Text style={fm.label}>Email</Text>
            <TextInput style={fm.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="Email" placeholderTextColor={C.textMuted} />

            <Text style={fm.label}>Location</Text>
            <TextInput style={fm.input} value={location} onChangeText={setLocation} placeholder="City / District" placeholderTextColor={C.textMuted} />

            <Text style={fm.label}>Total Students</Text>
            <TextInput style={fm.input} value={totalStudents} onChangeText={setTotalStudents} keyboardType="numeric" placeholder="e.g. 500" placeholderTextColor={C.textMuted} />

            <Text style={fm.label}>Assign To</Text>
            <Pressable
              style={[fm.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
              onPress={() => setShowAssignPicker(true)}
            >
              <Text style={{ fontSize: 14, color: assignedUser ? C.text : C.textMuted }}>
                {assignedUser ? assignedUser.name : 'Unassigned'}
              </Text>
              <Text style={{ fontSize: 12, color: C.textMuted }}>▼</Text>
            </Pressable>

            <Text style={fm.label}>Notes</Text>
            <TextInput style={[fm.input, fm.textarea]} value={notes} onChangeText={setNotes} multiline numberOfLines={3} textAlignVertical="top" placeholder="Notes about this referral..." placeholderTextColor={C.textMuted} />

            <Text style={fm.label}>Bonus Type</Text>
            <Pressable
              style={[fm.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
              onPress={() => setShowBonusPicker(true)}
            >
              <Text style={{ fontSize: 14, color: C.text }}>
                {bonusType === 'PERCENTAGE' ? 'Percentage of deal value (%)' : 'Fixed amount (₹)'}
              </Text>
              <Text style={{ fontSize: 12, color: C.textMuted }}>▼</Text>
            </Pressable>

            <Text style={fm.label}>{bonusLabel}</Text>
            <TextInput style={fm.input} value={bonusValue} onChangeText={setBonusValue} keyboardType="decimal-pad" placeholder={bonusType === 'PERCENTAGE' ? 'e.g. 5' : 'e.g. 5000'} placeholderTextColor={C.textMuted} />

            <Pressable style={[fm.submit, mutation.isPending && fm.submitDisabled]} onPress={handleSubmit} disabled={mutation.isPending}>
              {mutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={fm.submitText}>Create Referral</Text>}
            </Pressable>
          </ScrollView>

          {/* Bonus type picker */}
          <Modal visible={showBonusPicker} transparent animationType="fade" onRequestClose={() => setShowBonusPicker(false)}>
            <Pressable style={fm.overlay} onPress={() => setShowBonusPicker(false)}>
              <View style={fm.pickerSheet}>
                <Text style={fm.pickerTitle}>Bonus Type</Text>
                {(['FIXED', 'PERCENTAGE'] as const).map((t) => (
                  <Pressable
                    key={t}
                    style={[fm.pickerOpt, bonusType === t && fm.pickerOptActive]}
                    onPress={() => { setBonusType(t); setShowBonusPicker(false) }}
                  >
                    <Text style={[fm.pickerOptText, bonusType === t && fm.pickerOptActiveText]}>
                      {t === 'PERCENTAGE' ? 'Percentage of deal value (%)' : 'Fixed amount (₹)'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Pressable>
          </Modal>

          {/* Assignee picker */}
          <Modal visible={showAssignPicker} transparent animationType="fade" onRequestClose={() => setShowAssignPicker(false)}>
            <Pressable style={fm.overlay} onPress={() => setShowAssignPicker(false)}>
              <View style={fm.pickerSheet}>
                <Text style={fm.pickerTitle}>Assign To</Text>
                <Pressable
                  style={[fm.pickerOpt, assignedToId === null && fm.pickerOptActive]}
                  onPress={() => { setAssignedToId(null); setShowAssignPicker(false) }}
                >
                  <Text style={[fm.pickerOptText, assignedToId === null && fm.pickerOptActiveText]}>Unassigned</Text>
                </Pressable>
                {users.map((u) => (
                  <Pressable
                    key={u.id}
                    style={[fm.pickerOpt, assignedToId === u.id && fm.pickerOptActive]}
                    onPress={() => { setAssignedToId(u.id); setShowAssignPicker(false) }}
                  >
                    <Text style={[fm.pickerOptText, assignedToId === u.id && fm.pickerOptActiveText]}>{u.name}</Text>
                    <Text style={fm.pickerOptSub}>{u.role}</Text>
                  </Pressable>
                ))}
              </View>
            </Pressable>
          </Modal>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  )
}

function ReferralsTab({ lead }: { lead: Lead }) {
  const [showForm, setShowForm] = useState(false)

  const { data: referrals = [], isLoading } = useQuery<ReferralListItem[]>({
    queryKey: ['referrals', lead.id],
    queryFn: () => api.get(`/leads/${lead.id}/referrals`).then((r) => r.data),
  })

  if (isLoading) return <LoadingSpinner />

  return (
    <View style={{ flex: 1 }}>
      <View style={tab.actionRow}>
        <Pressable style={tab.addBtn} onPress={() => setShowForm(true)}>
          <Text style={tab.addBtnText}>+ Add Referral</Text>
        </Pressable>
      </View>
      {referrals.length === 0 ? (
        <EmptyState title="No referrals yet" subtitle="This school hasn't referred anyone yet" />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
          {referrals.map((r) => (
            <View key={r.leadId} style={rf.card}>
              <View style={rf.row}>
                <Text style={rf.name}>{r.schoolName}</Text>
                <StatusBadge status={r.status} size="sm" />
              </View>
              <Text style={rf.contact}>{r.contactPerson}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={rf.phone}>{r.phone}</Text>
                <ContactActions phone={r.phone} size="sm" />
              </View>
              <View style={rf.row}>
                <StatusBadge status={r.pipelineStage} size="sm" />
                {r.commission != null && (
                  <Text style={rf.commission}>Commission: {formatCurrency(r.commission)}</Text>
                )}
              </View>
              <View style={rf.row}>
                <Text style={rf.date}>{formatDate(r.createdAt)}</Text>
                <StatusBadge status={r.payoutStatus} size="sm" />
              </View>
            </View>
          ))}
        </ScrollView>
      )}
      <ReferralFormModal visible={showForm} leadId={lead.id} onClose={() => setShowForm(false)} />
    </View>
  )
}

// ─── TAB 1: Overview ─────────────────────────────────────────────────────────

function OverviewTab({ lead }: { lead: Lead }) {
  const router = useRouter()
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
      {/* Contact Info */}
      <View style={ov.card}>
        <Text style={ov.cardTitle}>Contact Info</Text>
        <Field label="Contact" value={lead.contactPerson} />
        <Field label="Phone" value={lead.phone} />
        {lead.email ? <Field label="Email" value={lead.email} /> : null}
        <View style={{ marginTop: 4, marginBottom: 2 }}>
          <ContactActions phone={lead.phone} email={lead.email ?? undefined} />
        </View>
        <Field label="Location" value={lead.location} />
        <Field label="Total Students" value={lead.totalStudents?.toString()} />
      </View>

      {/* Lead Details */}
      <View style={ov.card}>
        <Text style={ov.cardTitle}>Lead Details</Text>
        <Field label="Assigned To" value={lead.assignedTo?.name} />
        <Field label="Created" value={formatDate(lead.createdAt)} />
        <Field label="Updated" value={formatDate(lead.updatedAt)} />
        {lead.referredBySchool && (
          <Field
            label="Referred by"
            value={lead.referredBySchool.name}
            onPress={() => router.push(`/(app)/schools/${lead.referredBySchool!.id}`)}
          />
        )}
        {lead.referredByLead && (
          <Field
            label="Referred by Lead"
            value={lead.referredByLead.schoolName}
            onPress={() => router.push(`/(app)/leads/${lead.referredByLead!.id}`)}
          />
        )}
        {lead.referralNotes && (
          <Field label="Referral Notes" value={lead.referralNotes} />
        )}
      </View>

      {/* Notes */}
      {lead.notes && (
        <View style={ov.card}>
          <Text style={ov.cardTitle}>Notes</Text>
          <Text style={ov.notes}>{lead.notes}</Text>
        </View>
      )}
    </ScrollView>
  )
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const [tab, setTab] = useState<Tab>('Overview')
  const [showEdit, setShowEdit] = useState(false)

  const { data: lead, isLoading, refetch, isRefetching } = useQuery<Lead>({
    queryKey: ['leads', id],
    queryFn: () => api.get(`/leads/${id}`).then((r) => r.data),
    enabled: !!id,
  })

  const convertMutation = useMutation({
    mutationFn: () => api.post(`/leads/${id}/convert`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads', id] })
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      Alert.alert('Success', 'Lead converted to school successfully.')
    },
    onError: () => Alert.alert('Error', 'Failed to convert lead.'),
  })

  function handleConvert() {
    Alert.alert(
      'Convert to School',
      `Convert "${lead?.schoolName}" to a school? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Convert',
          style: 'default',
          onPress: () => convertMutation.mutate(),
        },
      ]
    )
  }

  const canConvert =
    lead &&
    lead.status !== 'CONVERTED' &&
    (user?.role === 'ADMIN' || user?.role === 'SALES_MANAGER')

  if (isLoading) return (
    <SafeAreaView style={s.safe}><LoadingSpinner /></SafeAreaView>
  )

  if (!lead) return (
    <SafeAreaView style={s.safe}>
      <EmptyState title="Lead not found" subtitle="This lead may have been deleted" />
    </SafeAreaView>
  )

  return (
    <SafeAreaView style={s.safe}>
      {/* Lead Header */}
      <View style={s.leadHeader}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={s.schoolName} numberOfLines={2}>{lead.schoolName}</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <StatusBadge status={lead.status} size="sm" />
            <StatusBadge status={lead.pipelineStage} size="sm" />
          </View>
        </View>
        <View style={{ gap: 8, alignItems: 'flex-end' }}>
          <Pressable style={s.editBtn} onPress={() => setShowEdit(true)}>
            <Text style={s.editBtnText}>Edit</Text>
          </Pressable>
          {canConvert && (
            <Pressable
              style={[s.convertBtn, convertMutation.isPending && { opacity: 0.6 }]}
              onPress={handleConvert}
              disabled={convertMutation.isPending}
            >
              {convertMutation.isPending
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={s.convertBtnText}>Convert</Text>
              }
            </Pressable>
          )}
        </View>
      </View>

      {/* Tab Bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.tabBar}
        contentContainerStyle={s.tabBarContent}
      >
        {TABS.map((t) => (
          <Pressable
            key={t}
            style={[s.tabBtn, tab === t && s.tabBtnActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[s.tabBtnText, tab === t && s.tabBtnActiveText]}>{t}</Text>
            {tab === t && <View style={s.tabUnderline} />}
          </Pressable>
        ))}
      </ScrollView>

      {/* Tab Content */}
      <View style={{ flex: 1 }}>
        {tab === 'Overview' && <OverviewTab lead={lead} />}
        {tab === 'Contacts' && <ContactsTab lead={lead} />}
        {tab === 'Quotations' && <QuotationsTab lead={lead} />}
        {tab === 'Add-Ons' && <AddOnsTab lead={lead} />}
        {tab === 'Timeline' && <TimelineTab lead={lead} />}
        {tab === 'Tasks' && <TasksTab lead={lead} />}
        {tab === 'Referrals' && <ReferralsTab lead={lead} />}
      </View>

      {/* Edit Modal */}
      {showEdit && (
        <EditLeadModal visible={showEdit} lead={lead} onClose={() => setShowEdit(false)} />
      )}
    </SafeAreaView>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  leadHeader: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 12,
    alignItems: 'flex-start',
  },
  schoolName: { fontSize: 18, fontWeight: '700', color: C.text },
  editBtn: {
    backgroundColor: C.grayLight,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: C.border,
  },
  editBtnText: { fontSize: 13, fontWeight: '600', color: C.text },
  convertBtn: {
    backgroundColor: C.success,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 7,
  },
  convertBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  tabBar: {
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    flexGrow: 0,
  },
  tabBarContent: { paddingHorizontal: 8 },
  tabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    position: 'relative',
  },
  tabBtnActive: {},
  tabBtnText: { fontSize: 14, fontWeight: '500', color: C.textSecondary },
  tabBtnActiveText: { color: C.primary, fontWeight: '700' },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 10,
    right: 10,
    height: 2,
    backgroundColor: C.primary,
    borderRadius: 2,
  },
})

const fd = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 12,
    alignItems: 'flex-start',
  },
  label: { fontSize: 13, color: C.textMuted, width: 110, fontWeight: '500' },
  value: { fontSize: 14, color: C.text, flex: 1, lineHeight: 20 },
  link: { color: C.primary, fontWeight: '500' },
})

const ov = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: C.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  notes: { fontSize: 14, color: C.text, lineHeight: 22 },
})

const tab = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.surface,
  },
  addBtn: {
    backgroundColor: C.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
})

const cont = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'flex-start',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '700', color: C.primary },
  name: { fontSize: 15, fontWeight: '700', color: C.text },
  designation: { fontSize: 13, color: C.textSecondary },
  phone: { fontSize: 13, color: C.primary, fontWeight: '500' },
  email: { fontSize: 13, color: C.textSecondary },
  primaryBadge: { backgroundColor: C.warningLight, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  primaryText: { fontSize: 11, fontWeight: '700', color: C.warning },
  actions: { gap: 4, justifyContent: 'center' },
  actionBtn: { padding: 6 },
  actionIcon: { fontSize: 16 },
})

const qt = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    gap: 8,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  id: { fontSize: 15, fontWeight: '700', color: C.text },
  meta: { fontSize: 13, color: C.textSecondary },
  total: { fontSize: 16, fontWeight: '700', color: C.success },
})

const qf = StyleSheet.create({
  sectionTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginTop: 8, marginBottom: 8 },
  itemCard: {
    backgroundColor: C.grayLight,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemIdx: { fontSize: 13, fontWeight: '600', color: C.textSecondary },
  removeBtn: { fontSize: 16, color: C.error, fontWeight: '700', padding: 4 },
  nameRow: { flexDirection: 'row', gap: 8 },
  catalogBtn: {
    backgroundColor: C.primaryLight,
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  catalogBtnText: { fontSize: 12, fontWeight: '600', color: C.primary },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 7,
    alignItems: 'center',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  typeBtnActive: { backgroundColor: C.primaryLight, borderColor: C.primary },
  typeBtnText: { fontSize: 13, fontWeight: '600', color: C.textSecondary },
  typeBtnActiveText: { color: C.primary },
  priceRow: { flexDirection: 'row', gap: 12 },
  strengthBtn: {
    backgroundColor: C.purpleLight,
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  strengthBtnText: { fontSize: 11, fontWeight: '600', color: C.purple },
  lineTotal: { fontSize: 13, fontWeight: '600', color: C.text, textAlign: 'right' },
  addItemBtn: {
    borderWidth: 1.5,
    borderColor: C.primary,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  addItemBtnText: { fontSize: 14, fontWeight: '600', color: C.primary },
  summaryCard: {
    backgroundColor: C.grayLight,
    borderRadius: 10,
    padding: 14,
    gap: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 14, color: C.textSecondary },
  summaryValue: { fontSize: 14, fontWeight: '600', color: C.text },
  summaryTotalRow: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 8,
    marginTop: 4,
  },
  summaryTotalLabel: { fontSize: 16, fontWeight: '700', color: C.text },
  summaryTotalValue: { fontSize: 16, fontWeight: '700', color: C.success },
})

const cat = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 12,
  },
  itemName: { fontSize: 14, fontWeight: '600', color: C.text },
  itemCat: { fontSize: 12, color: C.textMuted },
  itemDesc: { fontSize: 12, color: C.textSecondary },
  itemPrice: { fontSize: 14, fontWeight: '700', color: C.success },
})

const ao = StyleSheet.create({
  sectionTitle: { fontSize: 15, fontWeight: '700', color: C.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  card: {
    backgroundColor: C.surface,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  name: { fontSize: 14, fontWeight: '700', color: C.text },
  desc: { fontSize: 13, color: C.textSecondary, lineHeight: 18 },
  price: { fontSize: 14, fontWeight: '600', color: C.text },
  startDate: { fontSize: 12, color: C.textMuted, fontWeight: '400' },
  activeBadge: { backgroundColor: C.successLight, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  activeText: { fontSize: 11, fontWeight: '700', color: C.success },
  addBtn: {
    backgroundColor: C.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 7,
  },
  addBtnText: { fontSize: 13, fontWeight: '600', color: C.primary },
  removeBtn: {
    backgroundColor: C.errorLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 7,
  },
  removeBtnText: { fontSize: 13, fontWeight: '600', color: C.error },
})

const tl = StyleSheet.create({
  row: { flexDirection: 'row', gap: 14, marginBottom: 4 },
  leftCol: { width: 20, alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  line: { flex: 1, width: 2, backgroundColor: C.border, marginTop: 4, marginBottom: -4 },
  content: { flex: 1, paddingBottom: 20 },
  desc: { fontSize: 14, color: C.text, lineHeight: 20 },
  meta: { fontSize: 12, color: C.textMuted },
})

const tk = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'flex-start',
  },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.grayLight, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 18 },
  title: { fontSize: 14, fontWeight: '700', color: C.text },
  due: { fontSize: 12, color: C.textSecondary },
  assigned: { fontSize: 12, color: C.textMuted },
  notes: { fontSize: 12, color: C.textSecondary, lineHeight: 18 },
  checkBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.successLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIcon: { fontSize: 18, color: C.success, fontWeight: '700' },
})

const tkf = StyleSheet.create({
  typeBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: C.grayLight,
    borderWidth: 1,
    borderColor: C.border,
  },
  typeBtnActive: { backgroundColor: C.primaryLight, borderColor: C.primary },
  typeBtnText: { fontSize: 12, fontWeight: '600', color: C.textSecondary },
  typeBtnActiveText: { color: C.primary },
})

const rf = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    gap: 6,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  name: { fontSize: 15, fontWeight: '700', color: C.text, flex: 1 },
  contact: { fontSize: 13, color: C.textSecondary },
  phone: { fontSize: 13, color: C.primary, fontWeight: '500' },
  commission: { fontSize: 13, fontWeight: '600', color: C.success },
  date: { fontSize: 12, color: C.textMuted },
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
  cancelBtn: { fontSize: 15, color: C.primary, fontWeight: '500' },
  body: { padding: 16, gap: 4, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: '600', color: C.textSecondary, marginTop: 10, marginBottom: 4 },
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
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  toggleBox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBoxOn: { backgroundColor: C.primary, borderColor: C.primary },
  toggleTick: { color: '#fff', fontSize: 13, fontWeight: '700' },
  toggleLabel: { fontSize: 14, color: C.text, fontWeight: '500' },
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
  pickerSheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 32,
    maxHeight: '70%',
  },
  pickerTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 12 },
  pickerOpt: { paddingVertical: 12, paddingHorizontal: 12, borderRadius: 8, marginBottom: 2 },
  pickerOptActive: { backgroundColor: C.primaryLight },
  pickerOptText: { fontSize: 14, fontWeight: '500', color: C.text },
  pickerOptActiveText: { color: C.primary, fontWeight: '700' },
  pickerOptSub: { fontSize: 12, color: C.textMuted, marginTop: 1 },
})
