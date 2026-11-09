
import { useState } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Quotation, QuotationVersion, QuotationWorkflow } from '@lms/shared'
import { api } from '@/lib/api'
import { C } from '@/lib/colors'
import { useAuthStore } from '@/store/auth.store'
import { formatCurrency, formatDateTime } from '@/lib/utils'

const labels = { BASELINE: 'Previous version', REVISION: 'Pricing revision', SENT: 'Marked sent', EMAIL: 'Emailed', WHATSAPP: 'WhatsApp', SHARED: 'Prepared for sharing', ACCEPTED: 'Accepted' }
export function QuotationWorkflowPanel({ quotation, onShare }: { quotation: Quotation; onShare: (version: QuotationVersion) => void }) {
  const client = useQueryClient()
  const router = useRouter()
  const role = useAuthStore(s => s.user?.role)
  const [selected, setSelected] = useState<number>()
  const base = '/quotations/' + quotation.id
  const query = useQuery<QuotationWorkflow>({ queryKey: ['quotations', 'workflow', quotation.id], queryFn: () => api.get(base + '/workflow').then(r => r.data) })
  const version = useQuery<QuotationVersion>({
    queryKey: ['quotations', 'versions', quotation.id, selected], enabled: selected !== undefined,
    queryFn: () => api.get(base + '/versions/' + selected).then(r => r.data),
    meta: { skipPersist: true },
  })
  const refresh = () => client.invalidateQueries({ queryKey: ['quotations'] })
  const mutate = useMutation({
    mutationFn: (action: 'duplicate' | 'request' | 'approve' | 'reject') =>
      action === 'duplicate' ? api.post(base + '/duplicate') : action === 'request' ? api.post(base + '/approval')
        : api.patch(base + '/approval', { approved: action === 'approve', reviewedAt: quotation.updatedAt }),
    onSuccess: async (result, action) => {
      await refresh()
      if (action === 'duplicate') router.push(('/(app)/quotations/' + result.data.id) as never)
    },
    retry: false,
    onError: (error: any) => { Alert.alert('Quotation', error.response?.data?.message ?? 'Could not save. Please try again.'); void refresh() },
  })
  const workflow = query.data
  const button = (label: string, onPress: () => void) =>
    <Pressable accessibilityRole="button" disabled={mutate.isPending} onPress={onPress} style={{ paddingVertical: 8 }}><Text style={{ color: C.primary, fontWeight: '600' }}>{label}</Text></Pressable>
  return <View style={{ backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, borderRadius: 10, padding: 14, gap: 8 }}>
    <Text style={{ color: C.text, fontWeight: '700' }}>Approval and revision history</Text>
    {button('Duplicate as draft', () => mutate.mutate('duplicate'))}
    {query.isLoading && <Text>Loading…</Text>}
    {query.isError && button('Retry loading', () => void query.refetch())}
    {workflow && <>
      <Text>{workflow.requiresApproval ? 'Discount above ' + workflow.discountLimit + '% · ' + (workflow.approvalStatus === 'NONE' ? 'Approval required' : workflow.approvalStatus) : 'Discount is within the approval limit.'}</Text>
      {workflow.requiresApproval && ['NONE', 'REJECTED'].includes(workflow.approvalStatus) && button('Request approval', () => mutate.mutate('request'))}
      {workflow.approvalStatus === 'PENDING' && ['ADMIN', 'SALES_MANAGER'].includes(role ?? '') && <>
        {button('Approve discount', () => mutate.mutate('approve'))}{button('Reject', () => mutate.mutate('reject'))}
      </>}
      {workflow.versions.map(v => <View key={v.id}>{button('V' + v.number + ' · ' + labels[v.event], () => setSelected(v.id))}</View>)}
      {!workflow.versions.length && <Text>Versions appear after editing, marking sent, or preparing a PDF.</Text>}
    </>}
    {version.isError && button('Retry version', () => void version.refetch())}
    {version.data && <View style={{ borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10, gap: 4 }}>
      <Text style={{ fontWeight: '700' }}>Version {version.data.number} · {formatDateTime(version.data.createdAt)}</Text>
      {version.data.quotation.items.map(item => <Text key={item.id}>{item.name} · {item.quantity} × {formatCurrency(item.unitPrice)}</Text>)}
      <Text>Discount {formatCurrency(version.data.quotation.discount)} · Tax {formatCurrency(version.data.quotation.tax)}</Text>
      <Text style={{ fontWeight: '700' }}>Total {formatCurrency(version.data.quotation.total)}</Text>
      {version.data.canExport && button('Open version PDF', () => onShare(version.data!))}
    </View>}
  </View>
}
