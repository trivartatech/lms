import { useState, useEffect, useRef } from 'react'
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { Search, X, School as SchoolIcon, TrendingUp } from 'lucide-react-native'
import { C } from '@/lib/colors'
import { api } from '@/lib/api'
import type { Lead, School, PaginatedLeads } from '@lms/shared'

interface PaginatedSchools {
  data: School[]
  total: number
}

/**
 * Full-screen global search modal covering leads + schools. Mirrors the web
 * command-palette: one query, two result buckets, tap to navigate.
 */

interface Props {
  visible: boolean
  onClose: () => void
}

export function GlobalSearchModal({ visible, onClose }: Props) {
  const router = useRouter()
  const [input, setInput] = useState('')
  const [term, setTerm] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset state when re-opened
  useEffect(() => {
    if (visible) {
      setInput('')
      setTerm('')
    }
  }, [visible])

  function handleChange(text: string) {
    setInput(text)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setTerm(text.trim()), 250)
  }

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [])

  const enabled = visible && term.length >= 2

  const leadsQuery = useQuery<PaginatedLeads>({
    queryKey: ['global-search', 'leads', term],
    queryFn: () => api.get('/leads', { params: { search: term, limit: 10 } }).then((r) => r.data),
    enabled,
  })

  const schoolsQuery = useQuery<PaginatedSchools>({
    queryKey: ['global-search', 'schools', term],
    queryFn: () => api.get('/schools', { params: { search: term, limit: 10 } }).then((r) => r.data),
    enabled,
  })

  const leads = leadsQuery.data?.data ?? []
  const schools = schoolsQuery.data?.data ?? []
  const isLoading = enabled && (leadsQuery.isLoading || schoolsQuery.isLoading)
  const noResults = enabled && !isLoading && leads.length === 0 && schools.length === 0

  function goTo(path: string) {
    onClose()
    // tiny delay so modal close animation doesn't fight the navigation
    setTimeout(() => router.push(path as any), 120)
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.safe} edges={['top']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={s.header}>
            <View style={s.inputWrap}>
              <Search size={16} color={C.textMuted} />
              <TextInput
                style={s.input}
                value={input}
                onChangeText={handleChange}
                placeholder="Search leads and schools..."
                placeholderTextColor={C.textMuted}
                autoFocus
                autoCorrect={false}
                autoCapitalize="none"
              />
              {input.length > 0 && (
                <Pressable onPress={() => handleChange('')} hitSlop={6}>
                  <X size={16} color={C.textMuted} />
                </Pressable>
              )}
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={s.cancel}>Cancel</Text>
            </Pressable>
          </View>

          <FlatList
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <View>
                {!enabled && input.length > 0 && input.length < 2 && (
                  <Text style={s.hint}>Keep typing… (min 2 characters)</Text>
                )}
                {!enabled && input.length === 0 && (
                  <Text style={s.hint}>Type a school name, contact, phone or location.</Text>
                )}
                {isLoading && (
                  <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                    <ActivityIndicator color={C.primary} />
                  </View>
                )}
                {noResults && (
                  <Text style={s.hint}>No matches for "{term}".</Text>
                )}

                {!isLoading && leads.length > 0 && (
                  <Text style={s.section}>Leads · {leads.length}</Text>
                )}
                {!isLoading && leads.map((l: Lead) => (
                  <Pressable
                    key={`lead-${l.id}`}
                    style={({ pressed }) => [s.row, pressed && s.rowPressed]}
                    onPress={() => goTo(`/(app)/leads/${l.id}`)}
                  >
                    <View style={[s.iconWrap, { backgroundColor: C.primaryLight }]}>
                      <TrendingUp size={14} color={C.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.rowTitle} numberOfLines={1}>{l.schoolName}</Text>
                      <Text style={s.rowSub} numberOfLines={1}>
                        {l.contactPerson} · {l.phone}{l.location ? ` · ${l.location}` : ''}
                      </Text>
                    </View>
                    <Text style={s.stageChip}>{l.pipelineStage}</Text>
                  </Pressable>
                ))}

                {!isLoading && schools.length > 0 && (
                  <Text style={s.section}>Schools · {schools.length}</Text>
                )}
                {!isLoading && schools.map((sc: School) => (
                  <Pressable
                    key={`school-${sc.id}`}
                    style={({ pressed }) => [s.row, pressed && s.rowPressed]}
                    onPress={() => goTo(`/(app)/schools/${sc.id}`)}
                  >
                    <View style={[s.iconWrap, { backgroundColor: C.purpleLight }]}>
                      <SchoolIcon size={14} color={C.purple} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.rowTitle} numberOfLines={1}>{sc.name}</Text>
                      <Text style={s.rowSub} numberOfLines={1}>
                        {sc.contactPerson}{sc.phone ? ` · ${sc.phone}` : ''}{sc.location ? ` · ${sc.location}` : ''}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            }
            data={[]}
            renderItem={null as any}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.surface,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.bg,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  input: { flex: 1, fontSize: 15, color: C.text, padding: 0 },
  cancel: { fontSize: 15, color: C.primary, fontWeight: '500' },

  hint: {
    fontSize: 13,
    color: C.textMuted,
    paddingHorizontal: 16,
    paddingVertical: 18,
    textAlign: 'center',
  },
  section: {
    fontSize: 11,
    fontWeight: '700',
    color: C.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  rowPressed: { backgroundColor: C.primaryLight },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontSize: 14, fontWeight: '600', color: C.text },
  rowSub: { fontSize: 12, color: C.textSecondary, marginTop: 2 },
  stageChip: {
    fontSize: 10,
    fontWeight: '700',
    color: C.primary,
    backgroundColor: C.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
})
