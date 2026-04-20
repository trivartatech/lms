import { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import {
  User,
  Building2,
  Phone,
  ChevronDown,
  X,
  Plus,
  BookOpen,
  FileDown,
  Edit3,
} from 'lucide-react-native'
import { C } from '@/lib/colors'
import { formatCurrency, formatDate, getInitials } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { api } from '@/lib/api'
import type { Quotation, Addon } from '@lms/shared'

// ─── Types ────────────────────────────────────────────────────────────────────

type QuotationStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED'

const STATUS_OPTIONS: QuotationStatus[] = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED']

interface LineItem {
  key: string
  name: string
  type: 'ERP' | 'ADDON'
  quantity: string
  unitPrice: string
}

// ─── PDF Generator ────────────────────────────────────────────────────────────

function generateQuotationHTML(quotation: Quotation): string {
  const entityName = quotation.lead?.schoolName ?? quotation.school?.name ?? 'N/A'
  const contactPerson = quotation.lead?.contactPerson ?? quotation.school?.contactPerson ?? 'N/A'
  const phone = quotation.lead?.phone ?? quotation.school?.phone ?? 'N/A'
  const location = quotation.lead?.location ?? quotation.school?.location ?? ''
  const totalStudents = quotation.lead?.totalStudents ?? quotation.school?.totalStudents

  const itemRows = (quotation.items ?? [])
    .map(
      (item, i) => `
      <tr style="background:${i % 2 === 0 ? '#f9fafb' : '#ffffff'}">
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${item.name}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">
          <span style="background:${item.type === 'ERP' ? '#dbeafe' : '#ede9fe'};color:${item.type === 'ERP' ? '#1d4ed8' : '#6d28d9'};padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;">${item.type}</span>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantity}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">₹${item.unitPrice.toLocaleString('en-IN')}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">₹${item.total.toLocaleString('en-IN')}</td>
      </tr>`
    )
    .join('')

  const discountVal = quotation.discount ?? 0
  const taxRate = quotation.tax ?? 0
  const afterDiscount = quotation.subtotal - discountVal
  const taxVal = afterDiscount * (taxRate / 100)
  const perStudentStr =
    totalStudents && totalStudents > 0
      ? `<p style="color:#6b7280;font-size:13px;margin-top:4px;">Per student: ₹${Math.round(quotation.total / totalStudents).toLocaleString('en-IN')}</p>`
      : ''

  const statusColor: Record<QuotationStatus, string> = {
    DRAFT: '#374151',
    SENT: '#1d4ed8',
    ACCEPTED: '#15803d',
    REJECTED: '#b91c1c',
  }
  const statusBg: Record<QuotationStatus, string> = {
    DRAFT: '#f3f4f6',
    SENT: '#dbeafe',
    ACCEPTED: '#dcfce7',
    REJECTED: '#fee2e2',
  }
  const sc = statusColor[quotation.status as QuotationStatus] ?? '#374151'
  const sb = statusBg[quotation.status as QuotationStatus] ?? '#f3f4f6'

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #111827; background: #fff; }
  .page { padding: 40px; max-width: 800px; margin: auto; }
  h1 { font-size: 28px; font-weight: 800; color: #2563eb; margin-bottom: 4px; }
  .company-sub { font-size: 13px; color: #6b7280; margin-bottom: 32px; }
  .header-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }
  .entity-block { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; }
  .entity-block h3 { font-size: 15px; color: #374151; margin-bottom: 8px; }
  .entity-name { font-size: 18px; font-weight: 700; color: #111827; margin-bottom: 4px; }
  .entity-sub { font-size: 13px; color: #6b7280; }
  .quot-meta { text-align: right; }
  .quot-id { font-size: 20px; font-weight: 700; color: #111827; margin-bottom: 6px; }
  .status-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 700; background:${sb}; color:${sc}; }
  .quot-date { font-size: 13px; color: #6b7280; margin-top: 6px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
  thead { background: #2563eb; }
  thead th { color: #fff; padding: 12px; text-align: left; font-size: 13px; font-weight: 600; }
  thead th:not(:first-child) { text-align: center; }
  thead th:last-child { text-align: right; }
  .summary-box { display: flex; justify-content: flex-end; margin-bottom: 32px; }
  .summary-inner { width: 300px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; }
  .summary-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
  .summary-total { display: flex; justify-content: space-between; font-size: 18px; font-weight: 800; color: #2563eb; border-top: 2px solid #e5e7eb; padding-top: 10px; margin-top: 8px; }
  .footer { font-size: 12px; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 16px; }
</style>
</head>
<body>
<div class="page">
  <h1>Trivartha Tech Pvt Ltd</h1>
  <p class="company-sub">ERP Solutions &amp; Services</p>

  <div class="header-row">
    <div class="entity-block" style="flex:1;margin-right:24px;">
      <h3>Bill To</h3>
      <div class="entity-name">${entityName}</div>
      <div class="entity-sub">${contactPerson}</div>
      <div class="entity-sub">${phone}</div>
      ${location ? `<div class="entity-sub">${location}</div>` : ''}
      ${totalStudents ? `<div class="entity-sub">${totalStudents} students</div>` : ''}
    </div>
    <div class="quot-meta">
      <div class="quot-id">Quotation #${quotation.id}</div>
      <div><span class="status-badge">${quotation.status}</span></div>
      <div class="quot-date">Date: ${formatDate(quotation.createdAt)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th>Type</th>
        <th>Qty</th>
        <th>Unit Price</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="summary-box">
    <div class="summary-inner">
      <div class="summary-row">
        <span style="color:#6b7280;">Subtotal</span>
        <span>₹${quotation.subtotal.toLocaleString('en-IN')}</span>
      </div>
      <div class="summary-row">
        <span style="color:#6b7280;">Discount</span>
        <span style="color:#dc2626;">-₹${discountVal.toLocaleString('en-IN')}</span>
      </div>
      <div class="summary-row">
        <span style="color:#6b7280;">Tax (${taxRate}%)</span>
        <span>+₹${Math.round(taxVal).toLocaleString('en-IN')}</span>
      </div>
      <div class="summary-total">
        <span>Total</span>
        <span>₹${quotation.total.toLocaleString('en-IN')}</span>
      </div>
      ${perStudentStr}
    </div>
  </div>

  <div class="footer">
    <p>This quotation is valid for 30 days from the date of issue.</p>
    <p style="margin-top:4px;">Trivartha Tech Pvt Ltd · Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
  </div>
</div>
</body>
</html>`
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function QuotationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const queryClient = useQueryClient()
  const router = useRouter()

  const [showStatusPicker, setShowStatusPicker] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [generatingPDF, setGeneratingPDF] = useState(false)

  const { data: quotation, isLoading, refetch } = useQuery<Quotation>({
    queryKey: ['quotations', id],
    queryFn: () => api.get(`/quotations/${id}`).then((r) => r.data),
    enabled: !!id,
  })

  const statusMutation = useMutation({
    mutationFn: (status: QuotationStatus) =>
      api.put(`/quotations/${id}`, { status }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations', id] })
      queryClient.invalidateQueries({ queryKey: ['quotations'] })
      setShowStatusPicker(false)
    },
    onError: () => Alert.alert('Error', 'Failed to update status.'),
  })

  const handleSharePDF = async () => {
    if (!quotation) return
    setGeneratingPDF(true)
    try {
      const html = generateQuotationHTML(quotation)
      const { uri } = await Print.printToFileAsync({ html, base64: false })
      const canShare = await Sharing.isAvailableAsync()
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Quotation #${quotation.id}`,
          UTI: 'com.adobe.pdf',
        })
      } else {
        Alert.alert('Sharing unavailable', 'Sharing is not available on this device.')
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to generate PDF. Please try again.')
    } finally {
      setGeneratingPDF(false)
    }
  }

  if (isLoading || !quotation) return <LoadingSpinner />

  const isLead = !!quotation.lead
  const entityName = quotation.lead?.schoolName ?? quotation.school?.name ?? 'Unknown'
  const contactPerson = quotation.lead?.contactPerson ?? quotation.school?.contactPerson ?? ''
  const phone = quotation.lead?.phone ?? quotation.school?.phone ?? ''
  const location = quotation.lead?.location ?? quotation.school?.location
  const totalStudents = quotation.lead?.totalStudents ?? quotation.school?.totalStudents

  const discountVal = quotation.discount ?? 0
  const taxRate = quotation.tax ?? 0
  const afterDiscount = quotation.subtotal - discountVal
  const taxVal = afterDiscount * (taxRate / 100)

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* ── Top Card ── */}
        <View style={s.topCard}>
          <View style={s.topCardRow}>
            <View style={s.topCardLeft}>
              <Text style={s.quotTitle}>Quotation #{quotation.id}</Text>
              <Text style={s.quotDate}>{formatDate(quotation.createdAt)}</Text>
            </View>
            <StatusBadge status={quotation.status} />
          </View>

          {/* Status change */}
          <Pressable style={s.statusChangeBtn} onPress={() => setShowStatusPicker(!showStatusPicker)}>
            <Text style={s.statusChangeBtnText}>Change Status</Text>
            <ChevronDown size={14} color={C.primary} />
          </Pressable>

          {showStatusPicker && (
            <View style={s.statusDropdown}>
              {STATUS_OPTIONS.map((opt) => (
                <Pressable
                  key={opt}
                  style={[s.statusOption, quotation.status === opt && s.statusOptionActive]}
                  onPress={() => statusMutation.mutate(opt)}
                  disabled={statusMutation.isPending}
                >
                  <StatusBadge status={opt} size="sm" />
                  {quotation.status === opt && (
                    <Text style={s.statusOptionCheck}>✓</Text>
                  )}
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* ── Entity Card ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={[s.cardIconWrap, { backgroundColor: isLead ? C.primaryLight : '#ede9fe' }]}>
              {isLead
                ? <User size={18} color={C.primary} />
                : <Building2 size={18} color="#6d28d9" />
              }
            </View>
            <View style={s.cardHeaderText}>
              <Text style={s.entityType}>{isLead ? 'Lead' : 'School'}</Text>
              <Text style={s.entityName}>{entityName}</Text>
            </View>
          </View>
          <View style={s.entityDetails}>
            <Text style={s.entityDetailText}>{contactPerson}</Text>
            {location ? <Text style={s.entityDetailText}>{location}</Text> : null}
            {totalStudents != null && (
              <Text style={s.entityDetailText}>{totalStudents} students</Text>
            )}
            {phone ? (
              <Pressable
                style={s.phoneRow}
                onPress={() => Linking.openURL(`tel:${phone}`)}
              >
                <Phone size={13} color={C.primary} />
                <Text style={s.phoneText}>{phone}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* ── Line Items ── */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Line Items</Text>
          {/* Table header */}
          <View style={s.tableHeader}>
            <Text style={[s.tableHeaderCell, { flex: 3 }]}>Item</Text>
            <Text style={[s.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>Type</Text>
            <Text style={[s.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Qty</Text>
            <Text style={[s.tableHeaderCell, { flex: 2, textAlign: 'right' }]}>Total</Text>
          </View>

          {(quotation.items ?? []).map((item, i) => (
            <View key={item.id} style={[s.tableRow, i % 2 === 1 && s.tableRowAlt]}>
              <View style={{ flex: 3 }}>
                <Text style={s.tableCell}>{item.name}</Text>
                <Text style={s.tableCellSub}>
                  {formatCurrency(item.unitPrice)} each
                </Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <StatusBadge status={item.type} size="sm" />
              </View>
              <Text style={[s.tableCell, { flex: 1, textAlign: 'right' }]}>{item.quantity}</Text>
              <Text style={[s.tableCell, s.tableCellBold, { flex: 2, textAlign: 'right' }]}>
                {formatCurrency(item.total)}
              </Text>
            </View>
          ))}

          {(quotation.items?.length ?? 0) === 0 && (
            <Text style={s.emptyItemsText}>No items</Text>
          )}
        </View>

        {/* ── Summary ── */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Summary</Text>
          <View style={s.summaryBox}>
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>Subtotal</Text>
              <Text style={s.summaryValue}>{formatCurrency(quotation.subtotal)}</Text>
            </View>
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>Discount</Text>
              <Text style={[s.summaryValue, { color: C.error }]}>
                -{formatCurrency(discountVal)}
              </Text>
            </View>
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>Tax ({taxRate}%)</Text>
              <Text style={s.summaryValue}>+{formatCurrency(Math.round(taxVal))}</Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryRow}>
              <Text style={s.summaryTotalLabel}>Total</Text>
              <Text style={s.summaryTotalValue}>{formatCurrency(quotation.total)}</Text>
            </View>
            {totalStudents != null && totalStudents > 0 && (
              <Text style={s.perStudent}>
                {formatCurrency(Math.round(quotation.total / totalStudents))}/student
              </Text>
            )}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Actions Bar ── */}
      <View style={s.actionsBar}>
        <Pressable style={s.editBtn} onPress={() => setShowEditModal(true)}>
          <Edit3 size={16} color={C.primary} />
          <Text style={s.editBtnText}>Edit</Text>
        </Pressable>
        <Pressable
          style={[s.shareBtn, generatingPDF && s.shareBtnDisabled]}
          onPress={handleSharePDF}
          disabled={generatingPDF}
        >
          {generatingPDF ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <FileDown size={16} color="#fff" />
              <Text style={s.shareBtnText}>Share as PDF</Text>
            </>
          )}
        </Pressable>
      </View>

      {/* ── Edit Modal ── */}
      {quotation && (
        <EditQuotationModal
          visible={showEditModal}
          quotation={quotation}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['quotations', id] })
            queryClient.invalidateQueries({ queryKey: ['quotations'] })
            setShowEditModal(false)
          }}
        />
      )}
    </SafeAreaView>
  )
}

// ─── Edit Quotation Modal ─────────────────────────────────────────────────────

function EditQuotationModal({
  visible,
  quotation,
  onClose,
  onSuccess,
}: {
  visible: boolean
  quotation: Quotation
  onClose: () => void
  onSuccess: () => void
}) {
  const initItems = (): LineItem[] =>
    (quotation.items ?? []).map((it) => ({
      key: String(it.id),
      name: it.name,
      type: it.type as 'ERP' | 'ADDON',
      quantity: String(it.quantity),
      unitPrice: String(it.unitPrice),
    }))

  const [items, setItems] = useState<LineItem[]>(initItems)
  const [discount, setDiscount] = useState(String(quotation.discount ?? 0))
  const [tax, setTax] = useState(String(quotation.tax ?? 18))
  const [showCatalog, setShowCatalog] = useState(false)

  const totalStudents = quotation.lead?.totalStudents ?? quotation.school?.totalStudents ?? undefined

  const { data: catalog = [] } = useQuery<Addon[]>({
    queryKey: ['addons'],
    queryFn: () => api.get('/addons').then((r) => r.data),
    enabled: visible,
  })

  const mutation = useMutation({
    mutationFn: (payload: object) =>
      api.put(`/quotations/${quotation.id}`, payload).then((r) => r.data),
    onSuccess: () => {
      onSuccess()
    },
    onError: () => Alert.alert('Error', 'Failed to update quotation.'),
  })

  // Reset when opened
  const handleOpen = () => {
    setItems(initItems())
    setDiscount(String(quotation.discount ?? 0))
    setTax(String(quotation.tax ?? 18))
    setShowCatalog(false)
  }

  const subtotal = items.reduce(
    (acc, it) => acc + (parseFloat(it.quantity) || 0) * (parseFloat(it.unitPrice) || 0),
    0
  )
  const discountVal = parseFloat(discount) || 0
  const taxRate = parseFloat(tax) || 0
  const afterDiscount = subtotal - discountVal
  const taxVal = afterDiscount * (taxRate / 100)
  const total = afterDiscount + taxVal

  const getTierPrice = (addon: Addon, students: number | undefined): number => {
    if (!addon.tiers?.length || !students) return addon.price
    const tier = [...addon.tiers]
      .sort((a, b) => a.maxStudents - b.maxStudents)
      .find((t) => students <= t.maxStudents)
    return tier?.price ?? addon.tiers[addon.tiers.length - 1]?.price ?? addon.price
  }

  const addBlankItem = () =>
    setItems((prev) => [
      ...prev,
      { key: String(Date.now()), name: '', type: 'ADDON', quantity: '1', unitPrice: '0' },
    ])

  const updateItem = (key: string, field: keyof LineItem, value: string) =>
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, [field]: value } : it)))

  const removeItem = (key: string) =>
    setItems((prev) => prev.filter((it) => it.key !== key))

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
      Alert.alert('No student count', 'The linked entity has no total students set.')
      return
    }
    updateItem(key, 'quantity', String(totalStudents))
  }

  const submit = () => {
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
    mutation.mutate({
      items: items.map((it) => ({
        name: it.name.trim(),
        type: it.type,
        quantity: parseFloat(it.quantity) || 1,
        unitPrice: parseFloat(it.unitPrice) || 0,
        total: (parseFloat(it.quantity) || 1) * (parseFloat(it.unitPrice) || 0),
      })),
      discount: discountVal,
      tax: taxRate,
    })
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onShow={handleOpen}
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={em.header}>
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={20} color={C.textSecondary} />
          </Pressable>
          <Text style={em.headerTitle}>Edit Quotation #{quotation.id}</Text>
          <View style={{ width: 20 }} />
        </View>

        <ScrollView style={em.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Entity info (read-only) */}
          <View style={em.entityBanner}>
            <Text style={em.entityBannerLabel}>
              {quotation.lead ? 'Lead' : 'School'}
            </Text>
            <Text style={em.entityBannerName}>
              {quotation.lead?.schoolName ?? quotation.school?.name}
            </Text>
            {totalStudents != null && (
              <Text style={em.entityBannerSub}>{totalStudents} students</Text>
            )}
          </View>

          {/* Section: Line Items */}
          <View style={em.section}>
            <Text style={em.sectionTitle}>Line Items</Text>

            {items.map((item, idx) => (
              <View key={item.key} style={[em.itemRow, idx % 2 === 1 && em.itemRowAlt]}>
                <View style={em.itemTopRow}>
                  <TextInput
                    style={[em.itemInput, em.itemNameInput]}
                    placeholder="Item name"
                    placeholderTextColor={C.textMuted}
                    value={item.name}
                    onChangeText={(v) => updateItem(item.key, 'name', v)}
                  />
                  <Pressable
                    style={[em.typeBtn, item.type === 'ERP' && em.typeBtnERP]}
                    onPress={() =>
                      updateItem(item.key, 'type', item.type === 'ERP' ? 'ADDON' : 'ERP')
                    }
                  >
                    <Text style={[em.typeBtnText, item.type === 'ERP' && em.typeBtnTextERP]}>
                      {item.type}
                    </Text>
                  </Pressable>
                  <Pressable style={em.removeBtn} onPress={() => removeItem(item.key)}>
                    <X size={14} color={C.error} />
                  </Pressable>
                </View>
                <View style={em.itemBottomRow}>
                  <View style={em.itemFieldWrap}>
                    <Text style={em.itemFieldLabel}>Qty</Text>
                    <TextInput
                      style={em.itemSmallInput}
                      value={item.quantity}
                      onChangeText={(v) => updateItem(item.key, 'quantity', v)}
                      keyboardType="numeric"
                      placeholder="1"
                      placeholderTextColor={C.textMuted}
                    />
                  </View>
                  <Text style={em.itemMul}>×</Text>
                  <View style={em.itemFieldWrap}>
                    <Text style={em.itemFieldLabel}>Unit Price</Text>
                    <TextInput
                      style={em.itemSmallInput}
                      value={item.unitPrice}
                      onChangeText={(v) => updateItem(item.key, 'unitPrice', v)}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={C.textMuted}
                    />
                  </View>
                  <Text style={em.itemEquals}>=</Text>
                  <View style={em.itemFieldWrap}>
                    <Text style={em.itemFieldLabel}>Total</Text>
                    <Text style={em.itemTotal}>
                      {formatCurrency(
                        (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0)
                      )}
                    </Text>
                  </View>
                  {totalStudents != null && (
                    <Pressable style={em.strengthBtn} onPress={() => setStrength(item.key)}>
                      <Text style={em.strengthBtnText}>Strength</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))}

            <View style={em.itemActions}>
              <Pressable style={em.addItemBtn} onPress={addBlankItem}>
                <Plus size={14} color={C.primary} />
                <Text style={em.addItemBtnText}>Add Item</Text>
              </Pressable>
              <Pressable style={em.catalogBtn} onPress={() => setShowCatalog(!showCatalog)}>
                <BookOpen size={14} color={C.primary} />
                <Text style={em.catalogBtnText}>Pick from catalog</Text>
              </Pressable>
            </View>

            {showCatalog && (
              <View style={em.catalogList}>
                <Text style={em.catalogTitle}>Product Catalog</Text>
                {catalog.length === 0 ? (
                  <Text style={em.catalogEmpty}>No products</Text>
                ) : (
                  catalog.map((addon) => {
                    const price = getTierPrice(addon, totalStudents)
                    return (
                      <Pressable key={addon.id} style={em.catalogItem} onPress={() => addFromCatalog(addon)}>
                        <View style={{ flex: 1 }}>
                          <Text style={em.catalogItemName}>{addon.name}</Text>
                        </View>
                        <Text style={em.catalogItemPrice}>{formatCurrency(price)}</Text>
                      </Pressable>
                    )
                  })
                )}
              </View>
            )}
          </View>

          {/* Section: Pricing */}
          <View style={em.section}>
            <Text style={em.sectionTitle}>Pricing</Text>

            <View style={em.pricingRow}>
              <View style={em.pricingField}>
                <Text style={em.pricingLabel}>Discount (₹)</Text>
                <TextInput
                  style={em.pricingInput}
                  value={discount}
                  onChangeText={setDiscount}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={C.textMuted}
                />
              </View>
              <View style={em.pricingField}>
                <Text style={em.pricingLabel}>Tax (%)</Text>
                <TextInput
                  style={em.pricingInput}
                  value={tax}
                  onChangeText={setTax}
                  keyboardType="numeric"
                  placeholder="18"
                  placeholderTextColor={C.textMuted}
                />
              </View>
            </View>

            <View style={em.calcBox}>
              <View style={em.calcRow}>
                <Text style={em.calcLabel}>Subtotal</Text>
                <Text style={em.calcValue}>{formatCurrency(subtotal)}</Text>
              </View>
              <View style={em.calcRow}>
                <Text style={em.calcLabel}>Discount</Text>
                <Text style={[em.calcValue, { color: C.error }]}>-{formatCurrency(discountVal)}</Text>
              </View>
              <View style={em.calcRow}>
                <Text style={em.calcLabel}>Tax ({taxRate}%)</Text>
                <Text style={em.calcValue}>+{formatCurrency(taxVal)}</Text>
              </View>
              <View style={em.calcDivider} />
              <View style={em.calcRow}>
                <Text style={em.calcTotalLabel}>Total</Text>
                <Text style={em.calcTotalValue}>{formatCurrency(total)}</Text>
              </View>
              {totalStudents != null && totalStudents > 0 && (
                <Text style={em.perStudent}>
                  {formatCurrency(Math.round(total / totalStudents))}/student
                </Text>
              )}
            </View>
          </View>

          <Pressable
            style={[em.submitBtn, mutation.isPending && em.submitBtnDisabled]}
            onPress={submit}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={em.submitBtnText}>Save Changes</Text>
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
  scroll: { flex: 1 },
  content: { padding: 16 },
  topCard: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  topCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  topCardLeft: {},
  quotTitle: { fontSize: 20, fontWeight: '700', color: C.text },
  quotDate: { fontSize: 13, color: C.textSecondary, marginTop: 2 },
  statusChangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.primary,
    backgroundColor: C.primaryLight,
  },
  statusChangeBtnText: { fontSize: 13, fontWeight: '600', color: C.primary },
  statusDropdown: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: C.surface,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.grayLight,
  },
  statusOptionActive: { backgroundColor: C.grayLight },
  statusOptionCheck: { fontSize: 14, color: C.success, fontWeight: '700' },
  card: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  cardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: {},
  entityType: { fontSize: 11, fontWeight: '600', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  entityName: { fontSize: 17, fontWeight: '700', color: C.text },
  entityDetails: { gap: 4 },
  entityDetailText: { fontSize: 13, color: C.textSecondary },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  phoneText: { fontSize: 14, color: C.primary, fontWeight: '500' },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: C.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 4,
  },
  tableHeaderCell: { fontSize: 11, fontWeight: '700', color: '#fff' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: C.surface,
  },
  tableRowAlt: { backgroundColor: C.grayLight },
  tableCell: { fontSize: 13, color: C.text },
  tableCellSub: { fontSize: 11, color: C.textMuted, marginTop: 1 },
  tableCellBold: { fontWeight: '700', color: C.text },
  emptyItemsText: { textAlign: 'center', color: C.textMuted, fontSize: 13, padding: 16 },
  summaryBox: {},
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 14, color: C.textSecondary },
  summaryValue: { fontSize: 14, color: C.text, fontWeight: '500' },
  summaryDivider: { height: 1, backgroundColor: C.border, marginVertical: 8 },
  summaryTotalLabel: { fontSize: 17, fontWeight: '700', color: C.text },
  summaryTotalValue: { fontSize: 17, fontWeight: '800', color: C.primary },
  perStudent: { fontSize: 12, color: C.textMuted, textAlign: 'right', marginTop: 4 },
  actionsBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.primary,
    backgroundColor: C.primaryLight,
  },
  editBtnText: { fontSize: 15, fontWeight: '700', color: C.primary },
  shareBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: C.primary,
  },
  shareBtnDisabled: { opacity: 0.6 },
  shareBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
})

const em = StyleSheet.create({
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
  headerTitle: { fontSize: 16, fontWeight: '700', color: C.text, flex: 1, textAlign: 'center' },
  body: { flex: 1, backgroundColor: C.bg },
  entityBanner: {
    backgroundColor: C.primaryLight,
    margin: 16,
    marginBottom: 0,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#93c5fd',
  },
  entityBannerLabel: { fontSize: 11, fontWeight: '700', color: C.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  entityBannerName: { fontSize: 16, fontWeight: '700', color: C.text, marginTop: 2 },
  entityBannerSub: { fontSize: 12, color: C.textSecondary, marginTop: 2 },
  section: {
    backgroundColor: C.surface,
    marginTop: 12,
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  itemRow: { borderRadius: 8, padding: 10, marginBottom: 8, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  itemRowAlt: { backgroundColor: C.grayLight },
  itemTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  itemInput: { borderWidth: 1, borderColor: C.border, borderRadius: 6, padding: 8, fontSize: 13, color: C.text, backgroundColor: C.surface },
  itemNameInput: { flex: 1 },
  typeBtn: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6, backgroundColor: '#ede9fe', borderWidth: 1, borderColor: '#c4b5fd' },
  typeBtnERP: { backgroundColor: C.primaryLight, borderColor: '#93c5fd' },
  typeBtnText: { fontSize: 11, fontWeight: '700', color: '#6d28d9' },
  typeBtnTextERP: { color: C.primary },
  removeBtn: { padding: 6 },
  itemBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  itemFieldWrap: { alignItems: 'center' },
  itemFieldLabel: { fontSize: 10, color: C.textMuted, marginBottom: 2 },
  itemSmallInput: { borderWidth: 1, borderColor: C.border, borderRadius: 6, padding: 6, fontSize: 13, color: C.text, backgroundColor: C.surface, width: 64, textAlign: 'center' },
  itemMul: { fontSize: 14, color: C.textSecondary, marginTop: 10 },
  itemEquals: { fontSize: 14, color: C.textSecondary, marginTop: 10 },
  itemTotal: { fontSize: 13, fontWeight: '700', color: C.text, marginTop: 4 },
  strengthBtn: { paddingHorizontal: 8, paddingVertical: 5, backgroundColor: C.warningLight, borderRadius: 6, borderWidth: 1, borderColor: '#fcd34d', marginTop: 10 },
  strengthBtnText: { fontSize: 11, fontWeight: '600', color: C.warningText },
  itemActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  addItemBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, borderColor: C.primary, borderStyle: 'dashed' },
  addItemBtnText: { fontSize: 13, fontWeight: '600', color: C.primary },
  catalogBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, borderColor: C.primary, backgroundColor: C.primaryLight },
  catalogBtnText: { fontSize: 13, fontWeight: '600', color: C.primary },
  catalogList: { marginTop: 10, borderWidth: 1, borderColor: C.border, borderRadius: 8, overflow: 'hidden', backgroundColor: C.surface },
  catalogTitle: { fontSize: 12, fontWeight: '700', color: C.textSecondary, padding: 10, backgroundColor: C.grayLight, textTransform: 'uppercase' },
  catalogEmpty: { padding: 12, fontSize: 13, color: C.textMuted, textAlign: 'center' },
  catalogItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderBottomColor: C.grayLight },
  catalogItemName: { fontSize: 14, color: C.text, fontWeight: '500' },
  catalogItemPrice: { fontSize: 13, fontWeight: '700', color: C.primary },
  pricingRow: { flexDirection: 'row', gap: 12 },
  pricingField: { flex: 1 },
  pricingLabel: { fontSize: 12, fontWeight: '600', color: C.textSecondary, marginBottom: 6 },
  pricingInput: { borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 10, fontSize: 15, color: C.text, backgroundColor: C.surface },
  calcBox: { marginTop: 12, backgroundColor: C.grayLight, borderRadius: 10, padding: 14 },
  calcRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  calcLabel: { fontSize: 14, color: C.textSecondary },
  calcValue: { fontSize: 14, color: C.text, fontWeight: '500' },
  calcDivider: { height: 1, backgroundColor: C.border, marginVertical: 8 },
  calcTotalLabel: { fontSize: 16, fontWeight: '700', color: C.text },
  calcTotalValue: { fontSize: 16, fontWeight: '700', color: C.primary },
  perStudent: { fontSize: 12, color: C.textMuted, textAlign: 'right', marginTop: 4 },
  submitBtn: { margin: 16, backgroundColor: C.primary, borderRadius: 10, padding: 16, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})
