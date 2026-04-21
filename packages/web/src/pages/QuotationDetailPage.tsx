import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Edit, Printer, FileText, Download, Kanban, School } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { QuotationFormDialog } from '@/components/quotations/QuotationFormDialog'
import { Skeleton } from '@/components/ui/skeleton'
// QuotationPDF is lazy-loaded on demand to avoid crashing the app on startup
import type { Quotation, QuotationStatus } from '@lms/shared'
import { formatCurrency, formatDate } from '@/lib/utils'
import { toast } from '@/lib/toast-store'

const statusVariant: Record<QuotationStatus, string> = {
  DRAFT: 'secondary',
  SENT: 'info',
  ACCEPTED: 'success',
  REJECTED: 'destructive',
}

const STATUS_ORDER: QuotationStatus[] = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED']

export function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showEdit, setShowEdit] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [printLoading, setPrintLoading] = useState(false)

  const { data: quotation, isLoading } = useQuery<Quotation>({
    queryKey: ['quotations', id],
    queryFn: () => api.get(`/quotations/${id}`).then((r) => r.data),
  })

  const statusMutation = useMutation({
    mutationFn: (status: QuotationStatus) =>
      api.put(`/quotations/${id}`, { status }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations', id] })
      queryClient.invalidateQueries({ queryKey: ['quotations'] })
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-4xl">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-80" />
      </div>
    )
  }
  if (!quotation) {
    return <div className="py-12 text-center text-muted-foreground">Quotation not found</div>
  }

  const handlePrint = async () => {
    if (!quotation) return
    setPrintLoading(true)
    try {
      const { printQuotationPDF } = await import('@/components/quotations/QuotationPDF')
      await printQuotationPDF(quotation)
    } catch {
      window.print()
    } finally {
      setPrintLoading(false)
    }
  }

  const handleDownloadPDF = async () => {
    if (!quotation) return
    setPdfLoading(true)
    try {
      const { downloadQuotationPDF } = await import('@/components/quotations/QuotationPDF')
      await downloadQuotationPDF(quotation)
    } catch (err: any) {
      console.error('PDF generation failed:', err)
      const msg = err?.message ?? String(err)
      toast.error(`${msg}. Falling back to print.`, 'PDF generation failed')
      window.print()
    } finally {
      setPdfLoading(false)
    }
  }

  return (
    <>
      {/* Print styles — hides nav/header, shows only quotation content */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          aside, header { display: none !important; }
          main { margin-left: 0 !important; padding-top: 0 !important; }
          .print-break { page-break-inside: avoid; }
        }
      `}</style>

      <div className="space-y-5 max-w-4xl">
        {/* ── Top action bar ── */}
        <div className="flex items-center gap-3 no-print">
          <Button variant="ghost" size="icon" onClick={() => navigate('/quotations')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">
                {quotation.lead?.schoolName ?? quotation.school?.name ?? `Quotation #${quotation.id}`}
              </h1>
              <span className="text-muted-foreground text-lg font-normal">#{quotation.id}</span>
              <Badge variant={statusVariant[quotation.status] as any}>
                {quotation.status}
              </Badge>
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              {quotation.lead && (
                <Link to={`/leads/${quotation.lead.id}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                  <Kanban className="h-3 w-3" /> Lead: {quotation.lead.schoolName}
                </Link>
              )}
              {quotation.school && (
                <Link to={`/schools/${quotation.school.id}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                  <School className="h-3 w-3" /> School: {quotation.school.name}
                </Link>
              )}
              <p className="text-muted-foreground text-xs">
                Created {formatDate(quotation.createdAt)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Inline status change */}
            <Select
              value={quotation.status}
              onValueChange={(v) => statusMutation.mutate(v as QuotationStatus)}
              disabled={statusMutation.isPending}
            >
              <SelectTrigger className="h-8 text-sm w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_ORDER.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={handleDownloadPDF} disabled={pdfLoading}>
              <Download className="h-4 w-4 mr-1" />
              {pdfLoading ? 'Generating...' : 'Download PDF'}
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={printLoading}>
              <Printer className="h-4 w-4 mr-1" />
              {printLoading ? 'Preparing...' : 'Print'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
              <Edit className="h-4 w-4 mr-1" /> Edit
            </Button>
          </div>
        </div>

        {/* ── Print header (visible only when printing) ── */}
        <div className="hidden print:block mb-4">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-5 w-5" />
            <span className="text-xl font-bold">Quotation #{quotation.id}</span>
            <span className="ml-2 text-sm border rounded px-2 py-0.5">{quotation.status}</span>
          </div>
          {(quotation.lead || quotation.school) && (
            <p className="text-base font-semibold">
              {quotation.lead?.schoolName ?? quotation.school?.name}
            </p>
          )}
          <p className="text-sm text-muted-foreground">Date: {formatDate(quotation.createdAt)}</p>
        </div>

        {/* ── Linked entity info ── */}
        {(quotation.lead || quotation.school) && (
          <Card className="print-break">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Linked To</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-6 text-sm">
              {quotation.lead && (
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Lead</p>
                  <Link
                    to={`/leads/${quotation.lead.id}`}
                    className="text-primary hover:underline font-semibold no-print block"
                  >
                    {quotation.lead.schoolName}
                  </Link>
                  <span className="hidden print:block font-semibold">{quotation.lead.schoolName}</span>
                  <p className="text-muted-foreground">{quotation.lead.contactPerson}</p>
                  <p className="text-muted-foreground">{quotation.lead.phone}</p>
                </div>
              )}
              {quotation.school && (
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">School</p>
                  <Link
                    to={`/schools/${quotation.school.id}`}
                    className="text-primary hover:underline font-semibold no-print block"
                  >
                    {quotation.school.name}
                  </Link>
                  <span className="hidden print:block font-semibold">{quotation.school.name}</span>
                  <p className="text-muted-foreground">{quotation.school.contactPerson}</p>
                  <p className="text-muted-foreground">{quotation.school.phone}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Line items table ── */}
        <Card className="print-break">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Line Items</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="rounded-b-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-t">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Name</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground w-24">Type</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground w-20">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {quotation.items.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">{item.name}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="text-xs font-normal">
                          {item.type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{item.quantity}</td>
                    </tr>
                  ))}
                  {quotation.items.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                        No line items
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ── Summary section ── */}
        {(() => {
          const totalStudents =
            quotation.school?.totalStudents ?? quotation.lead?.totalStudents ?? null
          const perStudent =
            totalStudents && totalStudents > 0
              ? Math.round(quotation.total / totalStudents)
              : null

          return (
            <div className="flex justify-end">
              <Card className="w-80 print-break">
                <CardContent className="pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="tabular-nums">{formatCurrency(quotation.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="tabular-nums text-red-500">
                      {quotation.discount > 0 ? `− ${formatCurrency(quotation.discount)}` : formatCurrency(0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax</span>
                    <span className="tabular-nums">{formatCurrency(quotation.tax)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-base border-t pt-2 mt-1">
                    <span>Total</span>
                    <span className="tabular-nums">{formatCurrency(quotation.total)}</span>
                  </div>
                  {perStudent !== null && (
                    <div className="flex justify-between text-sm border-t pt-2 text-muted-foreground">
                      <span className="flex items-center gap-1">
                        Per Student
                        <span className="text-xs text-muted-foreground/60">
                          (÷ {totalStudents!.toLocaleString()} students)
                        </span>
                      </span>
                      <span className="tabular-nums font-semibold text-foreground">
                        {formatCurrency(perStudent)}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )
        })()}
      </div>

      <QuotationFormDialog
        open={showEdit}
        onClose={() => setShowEdit(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['quotations', id] })
          queryClient.invalidateQueries({ queryKey: ['quotations'] })
          setShowEdit(false)
        }}
        defaultLeadId={quotation.leadId}
        defaultSchoolId={quotation.schoolId}
        totalStudents={(quotation.school?.totalStudents ?? quotation.lead?.totalStudents) ?? undefined}
        quotation={quotation}
      />
    </>
  )
}
