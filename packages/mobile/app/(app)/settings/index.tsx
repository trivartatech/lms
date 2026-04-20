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
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Users,
  Plus,
  Edit3,
  Trash2,
  ChevronDown,
  ChevronUp,
  X,
  Lock,
  Package,
  Layers,
} from 'lucide-react-native'
import { C } from '@/lib/colors'
import { formatCurrency, getInitials } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'

// ─── Types ────────────────────────────────────────────────────────────────────

interface User {
  id: number
  name: string
  email: string
  role: 'ADMIN' | 'SALES_MANAGER' | 'SALES_EXECUTIVE'
}

interface Tier {
  label: string
  maxStudents: number
  price: number
}

interface Addon {
  id: number
  name: string
  description?: string
  price: number
  category: 'ERP' | 'ADDON'
  tiers?: Tier[]
}

const DEFAULT_TIERS: Tier[] = [
  { label: 'Small', maxStudents: 300, price: 0 },
  { label: 'Medium', maxStudents: 700, price: 0 },
  { label: 'Large', maxStudents: 1500, price: 0 },
  { label: 'Enterprise', maxStudents: 999999, price: 0 },
]

const ROLES = ['ADMIN', 'SALES_MANAGER', 'SALES_EXECUTIVE'] as const
type Role = typeof ROLES[number]

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'ADMIN'

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Settings</Text>
      </View>
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Section 1: Users (admin only) */}
        {isAdmin && <UsersSection />}

        {/* Section 2: ERP Products */}
        <AddonSection category="ERP" isAdmin={isAdmin} />

        {/* Section 3: Add-On Services */}
        <AddonSection category="ADDON" isAdmin={isAdmin} />

        {/* Section 4: Change Password */}
        <ChangePasswordSection />

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Users Section ────────────────────────────────────────────────────────────

function UsersSection() {
  const [showAddUser, setShowAddUser] = useState(false)
  const queryClient = useQueryClient()

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
  })

  return (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        <View style={s.sectionIconWrap}>
          <Users size={18} color={C.primary} />
        </View>
        <Text style={s.sectionTitle}>Users</Text>
        <Pressable style={s.sectionAddBtn} onPress={() => setShowAddUser(true)}>
          <Plus size={14} color={C.primary} />
          <Text style={s.sectionAddBtnText}>Add User</Text>
        </Pressable>
      </View>

      {isLoading && <ActivityIndicator color={C.primary} style={{ marginVertical: 12 }} />}

      {users.map((u) => (
        <View key={u.id} style={s.userRow}>
          <View style={s.userAvatar}>
            <Text style={s.userAvatarText}>{getInitials(u.name)}</Text>
          </View>
          <View style={s.userInfo}>
            <Text style={s.userName}>{u.name}</Text>
            <Text style={s.userEmail}>{u.email}</Text>
          </View>
          <StatusBadge status={u.role} size="sm" />
        </View>
      ))}

      {!isLoading && users.length === 0 && (
        <Text style={s.emptyText}>No users found</Text>
      )}

      <AddUserModal
        visible={showAddUser}
        onClose={() => setShowAddUser(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['users'] })
          setShowAddUser(false)
        }}
      />
    </View>
  )
}

// ─── Addon Section (ERP or ADDON) ─────────────────────────────────────────────

function AddonSection({ category, isAdmin }: { category: 'ERP' | 'ADDON'; isAdmin: boolean }) {
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingAddon, setEditingAddon] = useState<Addon | null>(null)
  const [deletingAddon, setDeletingAddon] = useState<Addon | null>(null)
  const [tierAddon, setTierAddon] = useState<Addon | null>(null)
  const [expandedTiers, setExpandedTiers] = useState<Set<number>>(new Set())
  const queryClient = useQueryClient()

  const { data: allAddons = [], isLoading } = useQuery<Addon[]>({
    queryKey: ['addons'],
    queryFn: () => api.get('/addons').then((r) => r.data),
  })

  const addons = allAddons.filter((a) => a.category === category)

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/addons/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addons'] })
      setDeletingAddon(null)
    },
    onError: () => Alert.alert('Error', 'Failed to delete product.'),
  })

  const toggleTiers = (id: number) => {
    setExpandedTiers((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const isERP = category === 'ERP'

  return (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        <View style={[s.sectionIconWrap, { backgroundColor: isERP ? C.primaryLight : '#ede9fe' }]}>
          {isERP ? <Package size={18} color={C.primary} /> : <Layers size={18} color="#6d28d9" />}
        </View>
        <Text style={s.sectionTitle}>{isERP ? 'ERP Products' : 'Add-On Services'}</Text>
        <Pressable
          style={s.sectionAddBtn}
          onPress={() => { setEditingAddon(null); setShowAddModal(true) }}
        >
          <Plus size={14} color={C.primary} />
          <Text style={s.sectionAddBtnText}>Add</Text>
        </Pressable>
      </View>

      {isLoading && <ActivityIndicator color={C.primary} style={{ marginVertical: 12 }} />}

      {addons.map((addon) => {
        const tiersOpen = expandedTiers.has(addon.id)
        return (
          <View key={addon.id} style={s.addonCard}>
            <View style={s.addonCardRow}>
              <View style={s.addonInfo}>
                <Text style={s.addonName}>{addon.name}</Text>
                {addon.description ? (
                  <Text style={s.addonDesc} numberOfLines={2}>{addon.description}</Text>
                ) : null}
                <Text style={s.addonPrice}>{formatCurrency(addon.price)}</Text>
              </View>
              <View style={s.addonActions}>
                <Pressable
                  style={s.addonActionBtn}
                  onPress={() => { setEditingAddon(addon); setShowAddModal(true) }}
                >
                  <Edit3 size={14} color={C.primary} />
                </Pressable>
                {isAdmin && (
                  <Pressable
                    style={[s.addonActionBtn, { backgroundColor: C.errorLight }]}
                    onPress={() => setDeletingAddon(addon)}
                  >
                    <Trash2 size={14} color={C.error} />
                  </Pressable>
                )}
              </View>
            </View>

            {/* Tiers toggle */}
            <View style={s.tiersRow}>
              <Pressable style={s.tiersToggleBtn} onPress={() => toggleTiers(addon.id)}>
                {tiersOpen ? <ChevronUp size={14} color={C.textSecondary} /> : <ChevronDown size={14} color={C.textSecondary} />}
                <Text style={s.tiersToggleText}>Pricing Tiers</Text>
              </Pressable>
              <Pressable style={s.editTiersBtn} onPress={() => setTierAddon(addon)}>
                <Text style={s.editTiersBtnText}>Edit Tiers</Text>
              </Pressable>
            </View>

            {tiersOpen && (
              <View style={s.tiersExpanded}>
                {(addon.tiers ?? []).length === 0 ? (
                  <Text style={s.tierEmptyText}>No custom tiers set</Text>
                ) : (
                  (addon.tiers ?? []).map((tier, i) => (
                    <View key={i} style={[s.tierRow, i % 2 === 1 && s.tierRowAlt]}>
                      <Text style={s.tierLabel}>{tier.label}</Text>
                      <Text style={s.tierStudents}>
                        {tier.maxStudents >= 999999 ? '1500+ students' : `≤${tier.maxStudents} students`}
                      </Text>
                      <Text style={s.tierPrice}>{formatCurrency(tier.price)}</Text>
                    </View>
                  ))
                )}
              </View>
            )}
          </View>
        )
      })}

      {!isLoading && addons.length === 0 && (
        <Text style={s.emptyText}>No {isERP ? 'ERP products' : 'add-on services'} yet</Text>
      )}

      {/* Add/Edit Modal */}
      <AddonFormModal
        visible={showAddModal}
        category={category}
        addon={editingAddon}
        onClose={() => { setShowAddModal(false); setEditingAddon(null) }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['addons'] })
          setShowAddModal(false)
          setEditingAddon(null)
        }}
      />

      {/* Delete confirm */}
      <ConfirmModal
        visible={!!deletingAddon}
        title="Delete Product"
        message={`Delete "${deletingAddon?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => deletingAddon && deleteMutation.mutate(deletingAddon.id)}
        onCancel={() => setDeletingAddon(null)}
      />

      {/* Tier editor */}
      {tierAddon && (
        <TierEditorModal
          visible={!!tierAddon}
          addon={tierAddon}
          onClose={() => setTierAddon(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['addons'] })
            setTierAddon(null)
          }}
        />
      )}
    </View>
  )
}

// ─── Add User Modal ────────────────────────────────────────────────────────────

function AddUserModal({
  visible,
  onClose,
  onSuccess,
}: {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('SALES_EXECUTIVE')
  const [showRolePicker, setShowRolePicker] = useState(false)

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/users', { name: name.trim(), email: email.trim(), password, role }).then((r) => r.data),
    onSuccess: () => {
      setName(''); setEmail(''); setPassword(''); setRole('SALES_EXECUTIVE')
      onSuccess()
    },
    onError: () => Alert.alert('Error', 'Failed to create user. Email may already be taken.'),
  })

  const submit = () => {
    if (!name.trim()) return Alert.alert('Required', 'Name is required.')
    if (!email.trim()) return Alert.alert('Required', 'Email is required.')
    if (!password.trim() || password.length < 6)
      return Alert.alert('Required', 'Password must be at least 6 characters.')
    mutation.mutate()
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={fm.header}>
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={20} color={C.textSecondary} />
          </Pressable>
          <Text style={fm.headerTitle}>Add User</Text>
          <View style={{ width: 20 }} />
        </View>
        <ScrollView style={fm.body} keyboardShouldPersistTaps="handled">
          <Text style={fm.label}>Name *</Text>
          <TextInput style={fm.input} value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={C.textMuted} autoCapitalize="words" />

          <Text style={fm.label}>Email *</Text>
          <TextInput style={fm.input} value={email} onChangeText={setEmail} placeholder="email@example.com" placeholderTextColor={C.textMuted} keyboardType="email-address" autoCapitalize="none" />

          <Text style={fm.label}>Password *</Text>
          <TextInput style={fm.input} value={password} onChangeText={setPassword} placeholder="Min 6 characters" placeholderTextColor={C.textMuted} secureTextEntry autoCapitalize="none" />

          <Text style={fm.label}>Role</Text>
          <Pressable style={fm.picker} onPress={() => setShowRolePicker(!showRolePicker)}>
            <Text style={fm.pickerText}>{role.replace(/_/g, ' ')}</Text>
            <ChevronDown size={16} color={C.textSecondary} />
          </Pressable>
          {showRolePicker && (
            <View style={fm.dropdown}>
              {ROLES.map((r) => (
                <Pressable
                  key={r}
                  style={[fm.dropdownItem, role === r && fm.dropdownItemActive]}
                  onPress={() => { setRole(r); setShowRolePicker(false) }}
                >
                  <Text style={[fm.dropdownItemText, role === r && fm.dropdownItemTextActive]}>
                    {r.replace(/_/g, ' ')}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <Pressable
            style={[fm.submitBtn, mutation.isPending && fm.submitBtnDisabled]}
            onPress={submit}
            disabled={mutation.isPending}
          >
            {mutation.isPending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={fm.submitBtnText}>Create User</Text>}
          </Pressable>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ─── Addon Form Modal ─────────────────────────────────────────────────────────

function AddonFormModal({
  visible,
  category,
  addon,
  onClose,
  onSuccess,
}: {
  visible: boolean
  category: 'ERP' | 'ADDON'
  addon: Addon | null
  onClose: () => void
  onSuccess: () => void
}) {
  const isEdit = !!addon
  const [name, setName] = useState(addon?.name ?? '')
  const [description, setDescription] = useState(addon?.description ?? '')
  const [price, setPrice] = useState(addon?.price != null ? String(addon.price) : '')

  // Sync fields when addon prop changes (opening for different addon)
  const syncFields = () => {
    setName(addon?.name ?? '')
    setDescription(addon?.description ?? '')
    setPrice(addon?.price != null ? String(addon.price) : '')
  }

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        price: parseFloat(price) || 0,
        category,
      }
      return isEdit
        ? api.put(`/addons/${addon!.id}`, payload).then((r) => r.data)
        : api.post('/addons', payload).then((r) => r.data)
    },
    onSuccess: () => {
      onSuccess()
    },
    onError: () => Alert.alert('Error', `Failed to ${isEdit ? 'update' : 'create'} product.`),
  })

  const submit = () => {
    if (!name.trim()) return Alert.alert('Required', 'Name is required.')
    if (!price.trim() || isNaN(parseFloat(price)))
      return Alert.alert('Required', 'A valid price is required.')
    mutation.mutate()
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onShow={syncFields}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={fm.header}>
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={20} color={C.textSecondary} />
          </Pressable>
          <Text style={fm.headerTitle}>
            {isEdit ? 'Edit' : 'Add'} {category === 'ERP' ? 'ERP Product' : 'Add-On Service'}
          </Text>
          <View style={{ width: 20 }} />
        </View>
        <ScrollView style={fm.body} keyboardShouldPersistTaps="handled">
          <Text style={fm.label}>Name *</Text>
          <TextInput
            style={fm.input}
            value={name}
            onChangeText={setName}
            placeholder="Product name"
            placeholderTextColor={C.textMuted}
          />

          <Text style={fm.label}>Description</Text>
          <TextInput
            style={[fm.input, { height: 80, textAlignVertical: 'top' }]}
            value={description}
            onChangeText={setDescription}
            placeholder="Optional description"
            placeholderTextColor={C.textMuted}
            multiline
          />

          <Text style={fm.label}>Base Price (₹) *</Text>
          <TextInput
            style={fm.input}
            value={price}
            onChangeText={setPrice}
            placeholder="0"
            placeholderTextColor={C.textMuted}
            keyboardType="numeric"
          />

          {/* Category badge (read-only indicator) */}
          <View style={fm.categoryBadgeWrap}>
            <Text style={fm.label}>Category</Text>
            <View style={[fm.categoryBadge, category === 'ERP' ? fm.categoryBadgeERP : fm.categoryBadgeAddon]}>
              <Text style={[fm.categoryBadgeText, category === 'ERP' ? fm.categoryBadgeTextERP : fm.categoryBadgeTextAddon]}>
                {category}
              </Text>
            </View>
          </View>

          <Pressable
            style={[fm.submitBtn, mutation.isPending && fm.submitBtnDisabled]}
            onPress={submit}
            disabled={mutation.isPending}
          >
            {mutation.isPending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={fm.submitBtnText}>{isEdit ? 'Save Changes' : 'Create Product'}</Text>}
          </Pressable>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ─── Tier Editor Modal ────────────────────────────────────────────────────────

function TierEditorModal({
  visible,
  addon,
  onClose,
  onSuccess,
}: {
  visible: boolean
  addon: Addon
  onClose: () => void
  onSuccess: () => void
}) {
  const initTiers = (): Tier[] => {
    if (addon.tiers && addon.tiers.length > 0) {
      return addon.tiers.map((t) => ({ ...t }))
    }
    return DEFAULT_TIERS.map((t) => ({ ...t }))
  }

  const [tiers, setTiers] = useState<Tier[]>(initTiers)

  const handleOpen = () => {
    setTiers(initTiers())
  }

  const updateTierPrice = (idx: number, value: string) => {
    setTiers((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, price: parseFloat(value) || 0 } : t))
    )
  }

  const resetToDefaults = () => {
    setTiers(DEFAULT_TIERS.map((t) => ({ ...t })))
  }

  const mutation = useMutation({
    mutationFn: () =>
      api.put(`/addons/${addon.id}`, {
        name: addon.name,
        price: addon.price,
        category: addon.category,
        tiers,
      }).then((r) => r.data),
    onSuccess: () => {
      onSuccess()
    },
    onError: () => Alert.alert('Error', 'Failed to update tiers.'),
  })

  const clearTiers = useMutation({
    mutationFn: () =>
      api.put(`/addons/${addon.id}`, {
        name: addon.name,
        price: addon.price,
        category: addon.category,
        tiers: [],
      }).then((r) => r.data),
    onSuccess: () => {
      onSuccess()
    },
    onError: () => Alert.alert('Error', 'Failed to reset tiers.'),
  })

  const TIER_LABELS = ['Small (<300)', 'Medium (300–700)', 'Large (701–1500)', 'Enterprise (1500+)']

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onShow={handleOpen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={fm.header}>
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={20} color={C.textSecondary} />
          </Pressable>
          <Text style={fm.headerTitle}>Pricing Tiers – {addon.name}</Text>
          <View style={{ width: 20 }} />
        </View>

        <ScrollView style={fm.body} keyboardShouldPersistTaps="handled">
          <Text style={tier.helpText}>
            Set per-student pricing for different school sizes. Leave at 0 to use the base price.
          </Text>

          {/* Tier rows */}
          <View style={tier.tableHeader}>
            <Text style={[tier.tableHeaderCell, { flex: 2 }]}>Tier</Text>
            <Text style={[tier.tableHeaderCell, { flex: 2, textAlign: 'right' }]}>Price (₹)</Text>
          </View>

          {tiers.map((t, i) => (
            <View key={i} style={[tier.row, i % 2 === 1 && tier.rowAlt]}>
              <View style={{ flex: 2 }}>
                <Text style={tier.tierLabel}>{TIER_LABELS[i] ?? t.label}</Text>
                <Text style={tier.tierStudents}>
                  {t.maxStudents >= 999999 ? '1500+ students' : `Up to ${t.maxStudents} students`}
                </Text>
              </View>
              <TextInput
                style={tier.priceInput}
                value={String(t.price)}
                onChangeText={(v) => updateTierPrice(i, v)}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={C.textMuted}
              />
            </View>
          ))}

          {/* Base price reminder */}
          <View style={tier.baseRow}>
            <Text style={tier.baseLabel}>Base Price (fallback)</Text>
            <Text style={tier.baseValue}>{formatCurrency(addon.price)}</Text>
          </View>

          {/* Buttons */}
          <Pressable
            style={[fm.submitBtn, mutation.isPending && fm.submitBtnDisabled]}
            onPress={() => mutation.mutate()}
            disabled={mutation.isPending || clearTiers.isPending}
          >
            {mutation.isPending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={fm.submitBtnText}>Save Tiers</Text>}
          </Pressable>

          <Pressable
            style={tier.resetBtn}
            onPress={() => {
              Alert.alert(
                'Reset Tiers',
                'This will remove all custom tiers. Continue?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Reset', style: 'destructive', onPress: () => clearTiers.mutate() },
                ]
              )
            }}
            disabled={mutation.isPending || clearTiers.isPending}
          >
            {clearTiers.isPending
              ? <ActivityIndicator color={C.error} size="small" />
              : <Text style={tier.resetBtnText}>Reset to Defaults</Text>}
          </Pressable>

          <Pressable style={tier.resetBtn} onPress={resetToDefaults}>
            <Text style={[tier.resetBtnText, { color: C.textSecondary }]}>Reset form to defaults</Text>
          </Pressable>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ─── Change Password Section ──────────────────────────────────────────────────

function ChangePasswordSection() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      api.put('/users/me/password', { currentPassword, newPassword }).then((r) => r.data),
    onSuccess: () => {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setErrorMsg('')
      setSuccessMsg('Password updated successfully.')
      setTimeout(() => setSuccessMsg(''), 4000)
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Failed to update password. Check your current password.'
      setErrorMsg(msg)
      setSuccessMsg('')
    },
  })

  const submit = () => {
    setErrorMsg('')
    setSuccessMsg('')
    if (!currentPassword) return setErrorMsg('Current password is required.')
    if (!newPassword || newPassword.length < 6)
      return setErrorMsg('New password must be at least 6 characters.')
    if (newPassword !== confirmPassword)
      return setErrorMsg('New password and confirm password do not match.')
    mutation.mutate()
  }

  return (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        <View style={[s.sectionIconWrap, { backgroundColor: C.warningLight }]}>
          <Lock size={18} color={C.warning} />
        </View>
        <Text style={s.sectionTitle}>Change Password</Text>
      </View>

      <Text style={pw.label}>Current Password</Text>
      <TextInput
        style={pw.input}
        value={currentPassword}
        onChangeText={setCurrentPassword}
        placeholder="Enter current password"
        placeholderTextColor={C.textMuted}
        secureTextEntry
        autoCapitalize="none"
      />

      <Text style={pw.label}>New Password</Text>
      <TextInput
        style={pw.input}
        value={newPassword}
        onChangeText={setNewPassword}
        placeholder="Min 6 characters"
        placeholderTextColor={C.textMuted}
        secureTextEntry
        autoCapitalize="none"
      />

      <Text style={pw.label}>Confirm New Password</Text>
      <TextInput
        style={pw.input}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="Repeat new password"
        placeholderTextColor={C.textMuted}
        secureTextEntry
        autoCapitalize="none"
      />

      {errorMsg ? (
        <View style={pw.errorBanner}>
          <Text style={pw.errorText}>{errorMsg}</Text>
        </View>
      ) : null}

      {successMsg ? (
        <View style={pw.successBanner}>
          <Text style={pw.successText}>{successMsg}</Text>
        </View>
      ) : null}

      <Pressable
        style={[pw.submitBtn, mutation.isPending && pw.submitBtnDisabled]}
        onPress={submit}
        disabled={mutation.isPending}
      >
        {mutation.isPending
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={pw.submitBtnText}>Update Password</Text>}
      </Pressable>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: C.text },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 0 },
  section: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  sectionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: C.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.text, flex: 1 },
  sectionAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.primary,
    backgroundColor: C.primaryLight,
  },
  sectionAddBtnText: { fontSize: 12, fontWeight: '700', color: C.primary },
  // Users
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.grayLight,
    gap: 12,
  },
  userAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  userInfo: { flex: 1 },
  userName: { fontSize: 14, fontWeight: '600', color: C.text },
  userEmail: { fontSize: 12, color: C.textSecondary, marginTop: 1 },
  // Addons
  addonCard: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    marginBottom: 10,
    overflow: 'hidden',
  },
  addonCardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    gap: 10,
  },
  addonInfo: { flex: 1 },
  addonName: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 2 },
  addonDesc: { fontSize: 12, color: C.textSecondary, marginBottom: 4 },
  addonPrice: { fontSize: 13, fontWeight: '600', color: C.primary },
  addonActions: { flexDirection: 'row', gap: 6 },
  addonActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: C.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tiersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 8,
  },
  tiersToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tiersToggleText: { fontSize: 12, color: C.textSecondary, fontWeight: '500' },
  editTiersBtn: {
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: C.grayLight,
  },
  editTiersBtnText: { fontSize: 11, fontWeight: '600', color: C.textSecondary },
  tiersExpanded: {
    backgroundColor: C.grayLight,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: C.surface,
  },
  tierRowAlt: { backgroundColor: C.grayLight },
  tierLabel: { fontSize: 13, fontWeight: '600', color: C.text, flex: 2 },
  tierStudents: { fontSize: 11, color: C.textMuted },
  tierPrice: { fontSize: 13, fontWeight: '700', color: C.primary, flex: 1, textAlign: 'right' },
  tierEmptyText: { padding: 12, fontSize: 12, color: C.textMuted, textAlign: 'center' },
  emptyText: { textAlign: 'center', color: C.textMuted, fontSize: 13, paddingVertical: 12 },
})

const fm = StyleSheet.create({
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
  body: { flex: 1, padding: 16 },
  label: { fontSize: 13, fontWeight: '600', color: C.gray, marginBottom: 6, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: C.text,
    backgroundColor: C.surface,
    marginBottom: 8,
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
    marginBottom: 4,
  },
  pickerText: { fontSize: 14, color: C.text },
  dropdown: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: C.surface,
    marginBottom: 8,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.grayLight,
  },
  dropdownItemActive: { backgroundColor: C.primaryLight },
  dropdownItemText: { fontSize: 14, color: C.text },
  dropdownItemTextActive: { color: C.primary, fontWeight: '700' },
  categoryBadgeWrap: { marginBottom: 8 },
  categoryBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  categoryBadgeERP: { backgroundColor: C.primaryLight },
  categoryBadgeAddon: { backgroundColor: '#ede9fe' },
  categoryBadgeText: { fontSize: 12, fontWeight: '700' },
  categoryBadgeTextERP: { color: C.primary },
  categoryBadgeTextAddon: { color: '#6d28d9' },
  submitBtn: {
    backgroundColor: C.primary,
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginTop: 12,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})

const pw = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: C.gray, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: C.text,
    backgroundColor: C.surface,
    marginBottom: 12,
  },
  errorBanner: {
    backgroundColor: C.errorLight,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  errorText: { fontSize: 13, color: C.errorText, fontWeight: '500' },
  successBanner: {
    backgroundColor: C.successLight,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  successText: { fontSize: 13, color: C.successText, fontWeight: '500' },
  submitBtn: {
    backgroundColor: C.primary,
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})

const tier = StyleSheet.create({
  helpText: {
    fontSize: 13,
    color: C.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: C.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 4,
  },
  tableHeaderCell: { fontSize: 12, fontWeight: '700', color: '#fff' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: C.surface,
    borderRadius: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  rowAlt: { backgroundColor: C.grayLight },
  tierLabel: { fontSize: 14, fontWeight: '600', color: C.text },
  tierStudents: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  priceInput: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 14,
    color: C.text,
    backgroundColor: C.surface,
    width: 100,
    textAlign: 'right',
  },
  baseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: C.grayLight,
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  baseLabel: { fontSize: 13, color: C.textSecondary },
  baseValue: { fontSize: 14, fontWeight: '700', color: C.text },
  resetBtn: {
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1.5,
    borderColor: C.error,
    backgroundColor: C.errorLight,
  },
  resetBtnText: { color: C.errorText, fontWeight: '600', fontSize: 14 },
})
