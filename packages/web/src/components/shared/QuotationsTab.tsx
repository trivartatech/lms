import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, FileText, ChevronRight } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { QuotationFormDialog } from '@/components/quotations/QuotationFormDialog'
import { Skeleton } from '@/components/ui/skeleton'
import type { Quotation, SchoolAddon } from '@lms/shared'
import { formatCurrency, formatDate } from '@/lib/utils'

const statusVariant: Record<string, any> = {
  DRAFT: 'secondary', SENT: 'info', ACCEPTED: 'success', REJECTED: 'destructive',
}

interface Props {
  schoolId?: number
  leadId?: number
  totalStudents?: number
}

export function QuotationsTab({ schoolId, leadId, totalStudents }: Props) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)

  const params = schoolId ? { schoolId } : { leadId }
  const queryKey = ['quotations', params]

  const { data: quotations, isLoading } = useQuery<Quotation[]>({
    queryKey,
    queryFn: () => api.get('/quotations', { params }).then((r) => r.data),
  })

  // Fetch active add-ons for this entity so we can pre-fill quotation items
  const entityPath = schoolId ? `/schools/${schoolId}` : leadId ? `/leads/${leadId}` : null
  const { data: activeAddons = [] } = useQuery<SchoolAddon[]>({
    queryKey: entityPath ? [entityPath, 'addons'] : ['noop'],
    queryFn: () => api.get(`${entityPath}/addons`).then((r) => r.data),
    enabled: !!entityPath,
  })

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Quotation
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
      ) : quotations?.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground text-sm border rounded-md bg-muted/20">
          No quotations yet
        </div>
      ) : (
        <div className="space-y-2">
          {quotations?.map((q) => (
            <Link key={q.id} to={`/quotations/${q.id}`} className="block group">
              <Card className="transition-colors hover:border-primary/50 hover:bg-muted/20">
                <CardContent className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Quotation #{q.id}</p>
                      <p className="text-xs text-muted-foreground">
                        {q.items.length} item{q.items.length !== 1 ? 's' : ''} · {formatDate(q.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-sm">{formatCurrency(q.total)}</span>
                    <Badge variant={statusVariant[q.status]}>{q.status}</Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <QuotationFormDialog
        open={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey })
          queryClient.invalidateQueries({ queryKey: ['quotations'] })
          setShowForm(false)
        }}
        defaultSchoolId={schoolId}
        defaultLeadId={leadId}
        totalStudents={totalStudents}
        defaultAddons={activeAddons}
      />
    </div>
  )
}
