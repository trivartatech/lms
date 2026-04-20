import { useState, useMemo } from 'react'
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, Plus, ChevronDown, X, BookOpen } from 'lucide-react-native'
import { C } from '@/lib/colors'
import { formatCurrency, formatDate } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { SearchBar } from '@/components/shared/SearchBar'
import { api } from '@/lib/api'
import type { Quotation, Addon } from '@lms/shared'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LineItem {
  key: string
  name: string
  type: 'ERP' | 'ADDON'
  quantity: string
  unitPrice: string
}

interface Lead {
  id: number
  schoolName: string
  contactPerson: string
  phone: string
  email?: string
  location?: string
  totalStudents?: number
}

interface School {
  id: number
  name: string
  contactPerson: string
  phone: string
  email?: string
  location?: string
  totalStudents?: number
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function QuotationsScreen() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const { data: quotations = [], isLoading, refetch } = useQuery<Quotation[]>({
    queryKey: ['quotations'],
    queryFn: () => api.get('/quotations').then((r) => r.data),
  })

  const filtered = useMemo(() => {
    if (!search.trim()) return quotations
    const q = search.toLowerCase()
    return quotations.filter((qt) => {
      const name = qt.lead?.schoolName ?? qt.school?.name ?? ''
      return (
        String(qt.id).includes(q) ||
        name.toLowerCase().includes(q) ||
        qt.status.toLowerCase().includes(q)
      )
    })
  }, [quotations, search])

  const onRefresh = async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }

  const entityLabel = (qt: Quotation) => {
    if (qt.lead) return { prefix: 'Lead', name: qt.lead.schoolName }
    if (qt.school) return { prefix: 'School', name: qt.school.name }
    return { prefix: '', name: 'Unknown' }
  }

  if (isLoading) return <LoadingSpinner />

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Quotations</Text>
          <Text style={s.headerSub}>{quotations.length} total</Text>
        </View>
        <Pressable style={s.newBtn} onPress={() => setShowForm(true)}>
          <Plus size={16} color="#fff" />
          <Text style={s.newBtnText}>New Quotation</Text>
        </Pressable>
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search quotations…" />
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={s.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        renderItem={({ item: qt }) => {
          const entity = entityLabel(qt)
          return (
            <Pressable style={s.card} onPress={() => router.push(`/(app)/quotations/${qt.id}`)}>
              {/* Card top row */}
              <View style={s.cardRow}>
                <View style={s.cardIconWrap}>
                  <FileText size={18} color={C.primary} />
                </View>
                <View style={s.cardMid}>
                  <Text style={s.cardTitle}>Quotation #{qt.id}</Text>
                  <View style={s.entityBadge}>
                    <Text style={s.entityBadgeText}>
                      {entity.prefix}: {entity.name}
                    </Text>
                  </View>
                </View>
                <View style={s.cardRight}>
                  <Text style={s.cardTotal}>{formatCurrency(qt.total)}</Text>
                  <StatusBadge status={qt.status} size="sm" />
                </View>
              </View>

              {/* Card bottom row */}
              <View style={s.cardFooter}>
                <Text style={s.cardMeta}>
                  {qt.items?.length ?? 0} item{(qt.items?.length ?? 0) !== 1 ? 's' : ''}
                </Text>
                <Text style={s.cardMeta}>{formatDate(qt.createdAt)}</Text>
              </View>
            </Pressable>
          )
        }}
        ListEmptyComponent={
          <EmptyState
            title="No quotations found"
            subtitle={search ? 'Try a different search term' : 'Tap "+ New Quotation" to create one'}
          />
        }
      />

      {/* Form Modal */}
      <QuotationFormModal
        visible={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['quotations'] })
          setShowForm(false)
        }}
      />
    </SafeAreaView>
  )
}

// ─── Quotation Form Modal ─────────────────────────────────────────────────────

function QuotationFormModal({
  visible,
  onClose,
  onSuccess,
}: {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  // Step 1: entity selection, Step 2: line items
  const [step, setStep] = useState<1 | 2>(1)
  const [entityType, setEntityType] = useState<'lead' | 'school'>('lead')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null)
  const [showEntityPicker, setShowEntityPicker] = useState(false)
  const [entitySearch, setEntitySearch] = useState('')
  const [showCatalog, setShowCatalog] = useState(false)
  const [items, setItems] = useState<LineItem[]>([])
  const [discount, setDiscount] = useState('0')
  const [tax, setTax] = useState('18')

  const { data: leads = [] } = useQuery<Lead[]>({
    queryKey: ['leads-minimal'],
    queryFn: () => api.get('/leads', { params: { limit: 200 } }).then((r) => r.data?.data ?? r.data),
    enabled: visible && entityType === 'lead',
  })

  const { data: schools = [] } = useQuery<School[]>({
    queryKey: ['schools-minimal'],
    queryFn: () => api.get('/schools', { params: { limit: 200 } }).then((r) => r.data?.data ?? r.data),
    enabled: visible && entityType === 'school',
  })

  const { data: catalog = [] } = useQuery<Addon[]>({
    queryKey: ['addons'],
    queryFn: () => api.get('/addons').then((r) => r.data),
    enabled: visible,
  })

  const mutation = useMutation({
    mutationFn: (payload: object) => api.post('/quotations', payload).then((r) => r.data),
    onSuccess: () => {
      resetForm()
      onSuccess()
    },
    onError: () => Alert.alert('Error', 'Failed to create quotation. Please try again.'),
  })

  const resetForm = () => {
    setStep(1)
    setEntityType('lead')
    setSelectedLead(null)
    setSelectedSchool(null)
    setEntitySearch('')
    setItems([])
    setDiscount('0')
    setTax('18')
    setShowEntityPicker(false)
    setShowCatalog(false)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const totalStudents =
    entityType === 'lead' ? selectedLead?.totalStudents : selectedSchool?.totalStudents

  // ── Calculations ──
  const subtotal = items.reduce((acc, it) => {
    const qty = parseFloat(it.quantity) || 0
    const price = parseFloat(it.unitPrice) || 0
    return acc + qty * price
  }, 0)
  const discountVal = parseFloat(discount) || 0
  const taxRate = parseFloat(tax) || 0
  const afterDiscount = subtotal - discountVal
  const taxVal = afterDiscount * (taxRate / 100)
  const total = afterDiscount + taxVal

  // ── Tier pricing helper ──
  const getTierPrice = (addon: Addon, students: number | undefined): number => {
    if (!addon.tiers?.length || !students) return addon.price
    const tier = [...addon.tiers]
      .sort((a, b) => a.maxStudents - b.maxStudents)
      .find((t) => students <= t.maxStudents)
    return tier?.price ?? addon.tiers[addon.tiers.length - 1]?.price ?? addon.price
  }

  // ── Item helpers ──
  const addBlankItem = () => {
    setItems((prev) => [
      ...prev,
      { key: String(Date.now()), name: '', type: 'ADDON', quantity: '1', unitPrice: '0' },
    ])
  }

  const updateItem = (key: string, field: keyof LineItem, value: string) => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, [field]: value } : it)))
  }

  const removeItem = (key: string) => {
    setItems((prev) => prev.filter((it) => it.key !== key))
  }

  const addFromCatalog = (addon: Addon) => {
    const price = getTierPrice(addon, totalStudents)
    const existing = items.find((it) => it.name === addon.name)
    if (existing) {
      setItems((prev) =>
        prev.map((it) =>
          it.key === existing.key
            ? { ...it, quantity: String(parseFloat(it.quantity) + 1) }
            : it
        )
      )
    } else {
      setItems((prev) => [
        ...prev,
        {
          key: String(Date.now()),
          name: addon.name,
          type: addon.category as 'ERP' | 'ADDON',
          quantity: '1',
          unitPrice: String(price),
        },
      ])
    }
    setShowCatalog(false)
  }

  const setStrength = (key: string) => {
    if (!totalStudents) {
      Alert.alert('No student count', 'The selected entity has no total students set.')
      return
    }
    updateItem(key, 'quantity', String(totalStudents))
  }

  // ── Submit ──
  const submit = () => {
    if (entityType === 'lead' && !selectedLead) {
      Alert.alert('Required', 'Please select a lead.')
      return
    }
    if (entityType === 'school' && !selectedSchool) {
      Alert.alert('Required', 'Please select a school.')
      return
    }
    if (items.length === 0) {
      Alert.alert('Required', 'Add at least one line item.')
      return
    }
    for (const it of items) {
      if (!it.name.trim()) {
        Alert.alert('Validation', 'All items must have a name.')
        return
      }
    }

    const payload = {
      ...(entityType === 'lead' ? { leadId: selectedLead!.id } : { schoolId: selectedSchool!.id }),
      items: items.map((it) => ({
        name: it.name.trim(),
        type: it.type,
        quantity: parseFloat(it.quantity) || 1,
        unitPrice: parseFloat(it.unitPrice) || 0,
        total: (parseFloat(it.quantity) || 1) * (parseFloat(it.unitPrice) || 0),
      })),
      discount: discountVal,
      tax: taxRate,
    }
    mutation.mutate(payload)
  }

  // ── Entity list for picker ──
  const entityList: Array<Lead | School> =
    entityType === 'lead'
      ? leads.filter((l) =>
          l.schoolName.toLowerCase().includes(entitySearch.toLowerCase())
        )
      : schools.filter((sc) =>
          sc.name.toLowerCase().includes(entitySearch.toLowerCase())
        )

  const selectedEntityName =
    entityType === 'lead'
      ? selectedLead?.schoolName
      : selectedSchool?.name

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Modal Header */}
        <View style={ms.header}>
          <Pressable onPress={handleClose} hitSlop={8}>
            <X size={20} color={C.textSecondary} />
          </Pressable>
          <Text style={ms.headerTitle}>New Quotation</Text>
          <View style={{ width: 20 }} />
        </View>

        <ScrollView style={ms.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* ── STEP 1: Entity Selection ── */}
          <View style={ms.section}>
            <Text style={ms.sectionTitle}>1. Link to Entity</Text>

            {/* Radio: Lead / School */}
            <View style={ms.radioRow}>
              {(['lead', 'school'] as const).map((opt) => (
                <Pressable
                  key={opt}
                  style={[ms.radio, entityType === opt && ms.radioActive]}
                  onPress={() => {
                    setEntityType(opt)
                    setSelectedLead(null)
                    setSelectedSchool(null)
                    setEntitySearch('')
                  }}
                >
                  <View style={[ms.radioCircle, entityType === opt && ms.radioCircleActive]}>
                    {entityType === opt && <View style={ms.radioDot} />}
                  </View>
                  <Text style={[ms.radioText, entityType === opt && ms.radioTextActive]}>
                    {opt === 'lead' ? 'Link to Lead' : 'Link to School'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Entity picker dropdown */}
            <Pressable style={ms.pickerBtn} onPress={() => setShowEntityPicker(!showEntityPicker)}>
              <Text style={[ms.pickerText, !selectedEntityName && { color: C.textMuted }]}>
                {selectedEntityName ?? `Select a ${entityType}…`}
              </Text>
              <ChevronDown size={16} color={C.textSecondary} />
            </Pressable>

            {showEntityPicker && (
              <View style={ms.dropdown}>
                <TextInput
                  style={ms.dropdownSearch}
                  placeholder={`Search ${entityType === 'lead' ? 'leads' : 'schools'}…`}
                  placeholderTextColor={C.textMuted}
                  value={entitySearch}
                  onChangeText={setEntitySearch}
                  autoFocus
                />
                <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                  {entityList.length === 0 && (
                    <Text style={ms.dropdownEmpty}>No results</Text>
                  )}
                  {entityList.map((item) => {
                    const name = entityType === 'lead' ? (item as Lead).schoolName : (item as School).name
                    return (
                      <Pressable
                        key={item.id}
                        style={ms.dropdownItem}
                        onPress={() => {
                          if (entityType === 'lead') setSelectedLead(item as Lead)
                          else setSelectedSchool(item as School)
                          setShowEntityPicker(false)
                          setEntitySearch('')
                        }}
                      >
                        <Text style={ms.dropdownItemText}>{name}</Text>
                        {(item as any).totalStudents && (
                          <Text style={ms.dropdownItemSub}>
                            {(item as any).totalStudents} students
                          </Text>
                        )}
                      </Pressable>
                    )
                  })}
                </ScrollView>
              </View>
            )}

            {/* Entity summary */}
            {(selectedLead || selectedSchool) && (
              <View style={ms.entityCard}>
                <Text style={ms.entityCardName}>
                  {entityType === 'lead' ? selectedLead?.schoolName : selectedSchool?.name}
                </Text>
                <Text style={ms.entityCardSub}>
                  {entityType === 'lead' ? selectedLead?.contactPerson : selectedSchool?.contactPerson}
                  {totalStudents ? ` · ${totalStudents} students` : ''}
                </Text>
              </View>
            )}
          </View>

          {/* ── STEP 2: Line Items ── */}
          <View style={ms.section}>
            <Text style={ms.sectionTitle}>2. Line Items</Text>

            {/* Items table */}
            {items.map((item, idx) => (
              <View key={item.key} style={[ms.itemRow, idx % 2 === 1 && ms.itemRowAlt]}>
                <View style={ms.itemTopRow}>
                  <TextInput
                    style={[ms.itemInput, ms.itemNameInput]}
                    placeholder="Item name"
                    placeholderTextColor={C.textMuted}
                    value={item.name}
                    onChangeText={(v) => updateItem(item.key, 'name', v)}
                  />
                  <Pressable
                    style={[ms.typeBtn, item.type === 'ERP' && ms.typeBtnERP]}
                    onPress={() =>
                      updateItem(item.key, 'type', item.type === 'ERP' ? 'ADDON' : 'ERP')
                    }
                  >
                    <Text style={[ms.typeBtnText, item.type === 'ERP' && ms.typeBtnTextERP]}>
                      {item.type}
                    </Text>
                  </Pressable>
                  <Pressable style={ms.removeBtn} onPress={() => removeItem(item.key)}>
                    <X size={14} color={C.error} />
                  </Pressable>
                </View>
                <View style={ms.itemBottomRow}>
                  <View style={ms.itemFieldWrap}>
                    <Text style={ms.itemFieldLabel}>Qty</Text>
                    <TextInput
                      style={ms.itemSmallInput}
                      value={item.quantity}
                      onChangeText={(v) => updateItem(item.key, 'quantity', v)}
                      keyboardType="numeric"
                      placeholder="1"
                      placeholderTextColor={C.textMuted}
                    />
                  </View>
                  <Text style={ms.itemMul}>×</Text>
                  <View style={ms.itemFieldWrap}>
                    <Text style={ms.itemFieldLabel}>Unit Price</Text>
                    <TextInput
                      style={ms.itemSmallInput}
                      value={item.unitPrice}
                      onChangeText={(v) => updateItem(item.key, 'unitPrice', v)}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={C.textMuted}
                    />
                  </View>
                  <Text style={ms.itemEquals}>=</Text>
                  <View style={ms.itemFieldWrap}>
                    <Text style={ms.itemFieldLabel}>Total</Text>
                    <Text style={ms.itemTotal}>
                      {formatCurrency((parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0))}
                    </Text>
                  </View>
                  {totalStudents != null && (
                    <Pressable style={ms.strengthBtn} onPress={() => setStrength(item.key)}>
                      <Text style={ms.strengthBtnText}>Strength</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))}

            {/* Action buttons */}
            <View style={ms.itemActions}>
              <Pressable style={ms.addItemBtn} onPress={addBlankItem}>
                <Plus size={14} color={C.primary} />
                <Text style={ms.addItemBtnText}>Add Item</Text>
              </Pressable>
              <Pressable style={ms.catalogBtn} onPress={() => setShowCatalog(!showCatalog)}>
                <BookOpen size={14} color={C.primary} />
                <Text style={ms.catalogBtnText}>Pick from catalog</Text>
              </Pressable>
            </View>

            {/* Catalog picker */}
            {showCatalog && (
              <View style={ms.catalogList}>
                <Text style={ms.catalogTitle}>Product Catalog</Text>
                {catalog.length === 0 ? (
                  <Text style={ms.dropdownEmpty}>No products in catalog</Text>
                ) : (
                  catalog.map((addon) => {
                    const price = getTierPrice(addon, totalStudents)
                    return (
                      <Pressable key={addon.id} style={ms.catalogItem} onPress={() => addFromCatalog(addon)}>
                        <View style={ms.catalogItemLeft}>
                          <Text style={ms.catalogItemName}>{addon.name}</Text>
                          <View style={[ms.typePill, addon.category === 'ERP' ? ms.typePillERP : ms.typePillAddon]}>
                            <Text style={[ms.typePillText, addon.category === 'ERP' ? ms.typePillTextERP : ms.typePillTextAddon]}>
                              {addon.category}
                            </Text>
                          </View>
                        </View>
                        <Text style={ms.catalogItemPrice}>
                          {formatCurrency(price)}
                          {totalStudents && price !== addon.price ? ' (tiered)' : ''}
                        </Text>
                      </Pressable>
                    )
                  })
                )}
              </View>
            )}
          </View>

          {/* ── STEP 3: Pricing ── */}
          <View style={ms.section}>
            <Text style={ms.sectionTitle}>3. Pricing</Text>

            <View style={ms.pricingRow}>
              <View style={ms.pricingField}>
                <Text style={ms.pricingLabel}>Discount (₹)</Text>
                <TextInput
                  style={ms.pricingInput}
                  value={discount}
                  onChangeText={setDiscount}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={C.textMuted}
                />
              </View>
              <View style={ms.pricingField}>
                <Text style={ms.pricingLabel}>Tax (%)</Text>
                <TextInput
                  style={ms.pricingInput}
                  value={tax}
                  onChangeText={setTax}
                  keyboardType="numeric"
                  placeholder="18"
                  placeholderTextColor={C.textMuted}
                />
              </View>
            </View>

            {/* Live calculation */}
            <View style={ms.calcBox}>
              <View style={ms.calcRow}>
                <Text style={ms.calcLabel}>Subtotal</Text>
                <Text style={ms.calcValue}>{formatCurrency(subtotal)}</Text>
              </View>
              <View style={ms.calcRow}>
                <Text style={ms.calcLabel}>Discount</Text>
                <Text style={[ms.calcValue, { color: C.error }]}>
                  -{formatCurrency(discountVal)}
                </Text>
              </View>
              <View style={ms.calcRow}>
                <Text style={ms.calcLabel}>Tax ({taxRate}%)</Text>
                <Text style={ms.calcValue}>+{formatCurrency(taxVal)}</Text>
              </View>
              <View style={ms.calcDivider} />
              <View style={ms.calcRow}>
                <Text style={ms.calcTotalLabel}>Total</Text>
                <Text style={ms.calcTotalValue}>{formatCurrency(total)}</Text>
              </View>
              {totalStudents != null && totalStudents > 0 && (
                <Text style={ms.perStudent}>
                  {formatCurrency(Math.round(total / totalStudents))}/student
                </Text>
              )}
            </View>
          </View>

          {/* Submit */}
          <Pressable
            style={[ms.submitBtn, mutation.isPending && ms.submitBtnDisabled]}
            onPress={submit}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={ms.submitBtnText}>Create Quotation</Text>
            )}
          </Pressable>

          <View style={{ height: 48 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: C.text },
  headerSub: { fontSize: 13, color: C.textSecondary, marginTop: 1 },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  newBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  searchWrap: { paddingHorizontal: 16, paddingVertical: 10 },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  card: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: C.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardMid: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 4 },
  entityBadge: {
    alignSelf: 'flex-start',
    backgroundColor: C.primaryLight,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  entityBadgeText: { fontSize: 11, fontWeight: '600', color: C.primary },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  cardTotal: { fontSize: 16, fontWeight: '700', color: C.text },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  cardMeta: { fontSize: 12, color: C.textMuted },
})

const ms = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 14,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: C.text },
  body: { flex: 1, backgroundColor: C.bg },
  section: {
    backgroundColor: C.surface,
    marginTop: 12,
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: C.textSecondary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  radioRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  radio: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.grayLight,
  },
  radioActive: { borderColor: C.primary, backgroundColor: C.primaryLight },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: { borderColor: C.primary },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary },
  radioText: { fontSize: 13, fontWeight: '500', color: C.textSecondary },
  radioTextActive: { color: C.primary, fontWeight: '600' },
  pickerBtn: {
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
  dropdown: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    backgroundColor: C.surface,
    overflow: 'hidden',
  },
  dropdownSearch: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    padding: 10,
    fontSize: 13,
    color: C.text,
  },
  dropdownEmpty: { padding: 12, fontSize: 13, color: C.textMuted, textAlign: 'center' },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.grayLight,
  },
  dropdownItemText: { fontSize: 14, color: C.text, fontWeight: '500' },
  dropdownItemSub: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  entityCard: {
    marginTop: 8,
    padding: 10,
    backgroundColor: C.primaryLight,
    borderRadius: 8,
  },
  entityCardName: { fontSize: 14, fontWeight: '600', color: C.primary },
  entityCardSub: { fontSize: 12, color: C.primary, marginTop: 2 },
  itemRow: { borderRadius: 8, padding: 10, marginBottom: 8, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  itemRowAlt: { backgroundColor: C.grayLight },
  itemTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  itemInput: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    padding: 8,
    fontSize: 13,
    color: C.text,
    backgroundColor: C.surface,
  },
  itemNameInput: { flex: 1 },
  typeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#ede9fe',
    borderWidth: 1,
    borderColor: '#c4b5fd',
  },
  typeBtnERP: { backgroundColor: C.primaryLight, borderColor: '#93c5fd' },
  typeBtnText: { fontSize: 11, fontWeight: '700', color: '#6d28d9' },
  typeBtnTextERP: { color: C.primary },
  removeBtn: { padding: 6 },
  itemBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  itemFieldWrap: { alignItems: 'center' },
  itemFieldLabel: { fontSize: 10, color: C.textMuted, marginBottom: 2 },
  itemSmallInput: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    padding: 6,
    fontSize: 13,
    color: C.text,
    backgroundColor: C.surface,
    width: 64,
    textAlign: 'center',
  },
  itemMul: { fontSize: 14, color: C.textSecondary, marginTop: 10 },
  itemEquals: { fontSize: 14, color: C.textSecondary, marginTop: 10 },
  itemTotal: { fontSize: 13, fontWeight: '700', color: C.text, marginTop: 4 },
  strengthBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: C.warningLight,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fcd34d',
    marginTop: 10,
  },
  strengthBtnText: { fontSize: 11, fontWeight: '600', color: C.warningText },
  itemActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  addItemBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: C.primary,
    borderStyle: 'dashed',
  },
  addItemBtnText: { fontSize: 13, fontWeight: '600', color: C.primary },
  catalogBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: C.primary,
    backgroundColor: C.primaryLight,
  },
  catalogBtnText: { fontSize: 13, fontWeight: '600', color: C.primary },
  catalogList: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: C.surface,
  },
  catalogTitle: { fontSize: 12, fontWeight: '700', color: C.textSecondary, padding: 10, backgroundColor: C.grayLight, textTransform: 'uppercase' },
  catalogItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.grayLight,
  },
  catalogItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  catalogItemName: { fontSize: 14, color: C.text, fontWeight: '500' },
  catalogItemPrice: { fontSize: 13, fontWeight: '700', color: C.primary },
  typePill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  typePillERP: { backgroundColor: C.primaryLight },
  typePillAddon: { backgroundColor: '#ede9fe' },
  typePillText: { fontSize: 10, fontWeight: '700' },
  typePillTextERP: { color: C.primary },
  typePillTextAddon: { color: '#6d28d9' },
  pricingRow: { flexDirection: 'row', gap: 12 },
  pricingField: { flex: 1 },
  pricingLabel: { fontSize: 12, fontWeight: '600', color: C.textSecondary, marginBottom: 6 },
  pricingInput: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    color: C.text,
    backgroundColor: C.surface,
  },
  calcBox: {
    marginTop: 12,
    backgroundColor: C.grayLight,
    borderRadius: 10,
    padding: 14,
  },
  calcRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  calcLabel: { fontSize: 14, color: C.textSecondary },
  calcValue: { fontSize: 14, color: C.text, fontWeight: '500' },
  calcDivider: { height: 1, backgroundColor: C.border, marginVertical: 8 },
  calcTotalLabel: { fontSize: 16, fontWeight: '700', color: C.text },
  calcTotalValue: { fontSize: 16, fontWeight: '700', color: C.primary },
  perStudent: { fontSize: 12, color: C.textMuted, textAlign: 'right', marginTop: 4 },
  submitBtn: {
    margin: 16,
    backgroundColor: C.primary,
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})
