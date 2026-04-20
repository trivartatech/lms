import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, FileText, ChevronRight, Kanban, School } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { QuotationFormDialog } from '@/components/quotations/QuotationFormDialog'
import { TableSkeleton } from '@/components/ui/skeleton'
import type { Quotation } from '@lms/shared'
import { formatCurrency, formatDate } from '@/lib/utils'

const statusVariant: Record<string, any> = {
  DRAFT: 'secondary', SENT: 'info', ACCEPTED: 'success', REJECTED: 'destructive',
}

export function QuotationsPage() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)

  const { data: quotations, isLoading } = useQuery<Quotation[]>({
    queryKey: ['quotations'],
    queryFn: () => api.get('/quotations').then((r) => r.data),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Quotations</h1>
          <p className="text-muted-foreground text-sm">{quotations?.length ?? 0} quotations</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Quotation
        </Button>
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} cols={4} />
      ) : (
        <div className="space-y-3">
          {quotations?.map((q) => {
            const entityName = q.lead?.schoolName ?? q.school?.name ?? `Quotation #${q.id}`
            const isLead = !!q.lead
            const entityId = q.lead?.id ?? q.school?.id

            return (
              <Link key={q.id} to={`/quotations/${q.id}`} className="block group">
                <Card className="transition-colors hover:border-primary/50 hover:bg-muted/20">
                  <CardContent className="py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm">{entityName}</p>
                          <span className="text-xs text-muted-foreground">· #{q.id}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {/* Clickable lead/school badge — stops propagation so it doesn't open the quotation */}
                          {entityId && (
                            <Link
                              to={isLead ? `/leads/${entityId}` : `/schools/${entityId}`}
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              {isLead
                                ? <><Kanban className="h-3 w-3" /> Lead</>
                                : <><School className="h-3 w-3" /> School</>
                              }
                            </Link>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {q.items.length} item{q.items.length !== 1 ? 's' : ''} · {formatDate(q.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-semibold">{formatCurrency(q.total)}</span>
                      <Badge variant={statusVariant[q.status]}>{q.status}</Badge>
                      <span className="text-xs text-primary font-medium flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        View <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
          {(!quotations || quotations.length === 0) && (
            <div className="text-center py-12 text-muted-foreground border rounded-md bg-muted/20">
              No quotations yet
            </div>
          )}
        </div>
      )}

      <QuotationFormDialog
        open={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['quotations'] })
          setShowForm(false)
        }}
      />
    </div>
  )
}
