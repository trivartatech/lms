import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { Download, Pencil } from 'lucide-react'
import { AgreementFormDialog } from '@/components/agreements/AgreementFormDialog'
import { TableSkeleton } from '@/components/ui/skeleton'
import type { Agreement } from '@lms/shared'
import { formatCurrency, formatDate } from '@/lib/utils'

function calcDuration(start?: string | null, end?: string | null) {
  if (!start || !end) return 1
  return Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / (365.25 * 24 * 60 * 60 * 1000)))
}

const statusVariant: Record<string, any> = {
  ACTIVE: 'success', EXPIRED: 'destructive', PENDING_RENEWAL: 'warning',
}

export function AgreementsPage() {
  const queryClient = useQueryClient()
  const { data: agreements, isLoading } = useQuery<Agreement[]>({
    queryKey: ['agreements'],
    queryFn: () => api.get('/agreements').then((r) => r.data),
  })

  const [downloadingId, setDownloadingId] = useState<number | null>(null)
  const [editing, setEditing]             = useState<Agreement | null>(null)

  const handleDownload = async (agreement: Agreement) => {
    setDownloadingId(agreement.id)
    try {
      const { downloadAgreementPDF } = await import('@/components/agreements/AgreementPDF')
      await downloadAgreementPDF(agreement)
    } catch (err: any) {
      console.error('Failed to generate PDF:', err)
      alert(`PDF generation failed:\n${err?.message ?? String(err)}`)
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Agreements</h1>
        <p className="text-muted-foreground text-sm">{agreements?.length ?? 0} agreements</p>
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} cols={4} />
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {['School', 'Value', 'Duration', 'Advance', 'Instalments', 'Status', ''].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {agreements?.map((a) => (
                <tr key={a.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link to={`/schools/${a.schoolId}`} className="text-primary hover:underline font-medium">
                      {a.school?.name ?? `School #${a.schoolId}`}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{formatCurrency(a.value)}/yr</p>
                    <p className="text-xs text-muted-foreground">{formatDate(a.startDate)} – {formatDate(a.endDate)}</p>
                  </td>
                  <td className="px-4 py-3">
                    {calcDuration(a.startDate, a.endDate)} {calcDuration(a.startDate, a.endDate) === 1 ? 'Year' : 'Years'}
                  </td>
                  <td className="px-4 py-3">
                    {Number(a.advancePayment) > 0
                      ? <span className="text-green-600 font-medium">{formatCurrency(Number(a.advancePayment))}</span>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {a.totalInstalments > 0 ? (() => {
                      const rem  = Number(a.value) - Number(a.advancePayment)
                      const inst = rem / a.totalInstalments
                      return (
                        <span className="text-blue-600 font-medium">
                          {a.totalInstalments}× {formatCurrency(Math.round(inst))}
                        </span>
                      )
                    })() : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant[a.status]}>{a.status.replace('_', ' ')}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditing(a)}
                        title="Edit agreement"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={downloadingId === a.id}
                        onClick={() => handleDownload(a)}
                        title="Download Agreement PDF"
                      >
                        <Download className="h-4 w-4 mr-1" />
                        {downloadingId === a.id ? 'Generating...' : 'PDF'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {(!agreements || agreements.length === 0) && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-muted-foreground">No agreements yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit dialog — schoolId is known from the agreement itself */}
      {editing && (
        <AgreementFormDialog
          open={!!editing}
          onClose={() => setEditing(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['agreements'] })
            setEditing(null)
          }}
          schoolId={editing.schoolId}
          agreement={editing}
        />
      )}
    </div>
  )
}
