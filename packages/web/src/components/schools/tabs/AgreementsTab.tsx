import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, FileCheck, Download, Pencil } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { AgreementFormDialog } from '../../agreements/AgreementFormDialog'
import type { Agreement } from '@lms/shared'
import { formatCurrency, formatDate } from '@/lib/utils'

function calcDuration(start?: string | null, end?: string | null) {
  if (!start || !end) return 1
  return Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / (365.25 * 24 * 60 * 60 * 1000)))
}

interface Props { schoolId: number }

const statusVariant: Record<string, any> = {
  ACTIVE: 'success', EXPIRED: 'destructive', PENDING_RENEWAL: 'warning',
}

export function AgreementsTab({ schoolId }: Props) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm]         = useState(false)
  const [editing, setEditing]           = useState<Agreement | null>(null)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  async function handleDownload(agreement: Agreement) {
    setDownloadingId(agreement.id)
    try {
      const { downloadAgreementPDF } = await import('../../agreements/AgreementPDF')
      await downloadAgreementPDF(agreement)
    } finally {
      setDownloadingId(null)
    }
  }

  const { data: agreements } = useQuery<Agreement[]>({
    queryKey: ['agreements', { schoolId }],
    queryFn: () => api.get('/agreements', { params: { schoolId } }).then((r) => r.data),
  })

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['agreements', { schoolId }] })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Agreements</h3>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Agreement
        </Button>
      </div>

      {agreements?.length ? (
        <div className="space-y-3">
          {agreements.map((a) => (
            <Card key={a.id}>
              <CardContent className="py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileCheck className="h-5 w-5 text-muted-foreground" />
                  <div className="space-y-0.5">
                    <p className="font-medium text-sm">
                      {formatCurrency(a.value)}/year
                      <span className="ml-2 text-muted-foreground font-normal text-xs">
                        · {calcDuration(a.startDate, a.endDate)} yr{calcDuration(a.startDate, a.endDate) > 1 ? 's' : ''}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(a.startDate)} – {formatDate(a.endDate)}
                    </p>
                    {/* Payment breakdown */}
                    {(Number(a.advancePayment) > 0 || a.totalInstalments > 0) && (() => {
                      const adv  = Number(a.advancePayment)
                      const rem  = Number(a.value) - adv
                      const inst = a.totalInstalments > 0 ? rem / a.totalInstalments : 0
                      return (
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                          {adv > 0 && (
                            <span className="text-xs text-green-600 font-medium">
                              Advance: {formatCurrency(adv)}
                            </span>
                          )}
                          {rem > 0 && a.totalInstalments > 0 && (
                            <span className="text-xs text-blue-600 font-medium">
                              {a.totalInstalments} instalments × {formatCurrency(Math.round(inst))}
                            </span>
                          )}
                          {adv > 0 && (
                            <span className="text-xs text-muted-foreground">
                              Remaining: {formatCurrency(rem)}
                            </span>
                          )}
                        </div>
                      )
                    })()}
                    {a.notes && <p className="text-xs text-muted-foreground italic">{a.notes}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant[a.status]}>{a.status.replace('_', ' ')}</Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditing(a)}
                    title="Edit agreement"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDownload(a)}
                    disabled={downloadingId === a.id}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    {downloadingId === a.id ? 'Generating...' : 'PDF'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground border rounded-md bg-muted/20">
          No agreements yet
        </div>
      )}

      {/* New agreement */}
      <AgreementFormDialog
        open={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={() => { invalidate(); setShowForm(false) }}
        schoolId={schoolId}
      />

      {/* Edit agreement */}
      <AgreementFormDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        onSuccess={() => { invalidate(); setEditing(null) }}
        schoolId={schoolId}
        agreement={editing ?? undefined}
      />
    </div>
  )
}
