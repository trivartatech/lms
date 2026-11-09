
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Quotation, QuotationWorkflow, QuotationVersion } from '@lms/shared'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { toast } from '@/lib/toast-store'

const eventLabel = { BASELINE: 'Previous version', REVISION: 'Pricing revision', SENT: 'Marked sent', EMAIL: 'Emailed', WHATSAPP: 'WhatsApp', SHARED: 'Prepared for sharing', ACCEPTED: 'Accepted' }

export function QuotationWorkflowPanel({ quotation }: { quotation: Quotation }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const role = useAuthStore(s => s.user?.role)
  const [selected, setSelected] = useState<number>()
  const base = '/quotations/' + quotation.id
  const query = useQuery<QuotationWorkflow>({ queryKey: ['quotations', 'workflow', quotation.id], queryFn: () => api.get(base + '/workflow').then(r => r.data) })
  const version = useQuery<QuotationVersion>({
    queryKey: ['quotations', 'versions', quotation.id, selected], enabled: selected !== undefined,
    queryFn: () => api.get(base + '/versions/' + selected).then(r => r.data),
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['quotations'] })
  const action = useMutation({
    mutationFn: (kind: 'duplicate' | 'request' | 'approve' | 'reject') =>
      kind === 'duplicate' ? api.post(base + '/duplicate') : kind === 'request' ? api.post(base + '/approval')
        : api.patch(base + '/approval', { approved: kind === 'approve', reviewedAt: quotation.updatedAt }),
    onSuccess: async (response, kind) => {
      await refresh()
      if (kind === 'duplicate') navigate('/quotations/' + response.data.id)
    },
    onError: () => { void refresh() },
  })
  async function download() {
    const data = version.data
    if (!data) return
    try {
      if (!data.pdfBase64) {
        const { downloadQuotationPDF } = await import('./QuotationPDF')
        await downloadQuotationPDF(data.quotation)
        return
      }
      const bytes = Uint8Array.from(atob(data.pdfBase64), c => c.charCodeAt(0))
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      link.download = 'quotation-' + quotation.id + '-v' + data.number + '.pdf'
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { toast.error('Could not download this version') }
  }
  const workflow = query.data
  return <section className="space-y-3 rounded-lg border p-4 print:hidden">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Approval and revision history</h2>
      <Button variant="outline" size="sm" disabled={action.isPending} onClick={() => action.mutate('duplicate')}>Duplicate as draft</Button>
    </div>
    {query.isLoading && <p className="text-sm">Loading approval and versions…</p>}
    {query.isError && <Button variant="outline" onClick={() => void query.refetch()}>Retry loading history</Button>}
    {workflow && <>
      <p className="text-sm">{workflow.requiresApproval ? 'Discount above ' + workflow.discountLimit + '% · ' + (workflow.approvalStatus === 'NONE' ? 'Approval required' : workflow.approvalStatus) : 'Discount is within the approval limit.'}</p>
      {workflow.requiresApproval && ['NONE', 'REJECTED'].includes(workflow.approvalStatus) &&
        <Button size="sm" disabled={action.isPending} onClick={() => action.mutate('request')}>Request approval</Button>}
      {workflow.approvalStatus === 'PENDING' && ['ADMIN', 'SALES_MANAGER'].includes(role ?? '') && <div className="flex gap-2">
        <Button size="sm" disabled={action.isPending} onClick={() => action.mutate('approve')}>Approve discount</Button>
        <Button size="sm" variant="outline" disabled={action.isPending} onClick={() => action.mutate('reject')}>Reject</Button>
      </div>}
      {workflow.versions.length === 0 && <p className="text-sm text-muted-foreground">Versions appear after editing, marking sent, or preparing a PDF.</p>}
      <div className="flex flex-wrap gap-2">{workflow.versions.map(v => <Button key={v.id} size="sm" variant={selected === v.id ? 'default' : 'outline'} onClick={() => setSelected(v.id)}>
        V{v.number} · {eventLabel[v.event]}
      </Button>)}</div>
    </>}
    {version.isError && <Button variant="outline" onClick={() => void version.refetch()}>Retry version</Button>}
    {version.data && <div className="space-y-2 border-t pt-3 text-sm">
      <p className="font-semibold">Version {version.data.number} · {new Date(version.data.createdAt).toLocaleString()}</p>
      {version.data.quotation.items.map(item => <p key={item.id}>{item.name} · {item.quantity} × {formatCurrency(item.unitPrice)}</p>)}
      <p>Discount {formatCurrency(version.data.quotation.discount)} · Tax {formatCurrency(version.data.quotation.tax)}</p>
      <p className="font-semibold">Total {formatCurrency(version.data.quotation.total)}</p>
      {version.data.canExport && <Button size="sm" variant="outline" onClick={() => void download()}>Download this version</Button>}
    </div>}
  </section>
}
