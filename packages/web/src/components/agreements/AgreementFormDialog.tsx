import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { api } from '@/lib/api'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import type { Agreement, Quotation } from '@lms/shared'
import { formatCurrency } from '@/lib/utils'

const DURATION_OPTIONS = [1, 2, 3, 4, 5] as const

const schema = z.object({
  startDate:        z.string().min(1, 'Required'),
  durationYears:    z.coerce.number().min(1).max(5),
  value:            z.coerce.number().min(1, 'Must be > 0'),
  advancePayment:   z.coerce.number().min(0).default(0),
  totalInstalments: z.coerce.number().min(0).default(0),
  status:           z.enum(['ACTIVE', 'EXPIRED', 'PENDING_RENEWAL']),
  notes:            z.string().optional(),
})
type FormData = z.infer<typeof schema>

function addYears(dateStr: string, years: number): string {
  const d = new Date(dateStr)
  d.setFullYear(d.getFullYear() + years)
  return d.toISOString().slice(0, 10)
}

function calcDuration(start?: string | null, end?: string | null): number {
  if (!start || !end) return 1
  const ms = new Date(end).getTime() - new Date(start).getTime()
  return Math.max(1, Math.min(5, Math.round(ms / (365.25 * 24 * 60 * 60 * 1000)) || 1))
}

const toDateInput = (val?: string | null) =>
  val ? new Date(val).toISOString().slice(0, 10) : ''

interface Props {
  open:       boolean
  onClose:    () => void
  onSuccess:  () => void
  schoolId:   number
  agreement?: Agreement
}

export function AgreementFormDialog({ open, onClose, onSuccess, schoolId, agreement }: Props) {
  const isEdit = !!agreement

  // Fetch accepted quotation for this school (create mode only)
  const { data: quotations } = useQuery<Quotation[]>({
    queryKey: ['quotations', { schoolId }],
    queryFn: () => api.get('/quotations', { params: { schoolId } }).then((r) => r.data),
    enabled: open && !isEdit,
  })

  const acceptedQuotation = quotations
    ?.filter((q) => q.status === 'ACCEPTED')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'ACTIVE', durationYears: 1, advancePayment: 0, totalInstalments: 0 },
  })

  useEffect(() => {
    if (!open) return
    if (agreement) {
      reset({
        startDate:        toDateInput(agreement.startDate),
        durationYears:    calcDuration(agreement.startDate, agreement.endDate),
        value:            Number(agreement.value),
        advancePayment:   Number(agreement.advancePayment),
        totalInstalments: agreement.totalInstalments,
        status:           agreement.status,
        notes:            agreement.notes ?? '',
      })
    } else {
      reset({
        startDate:        new Date().toISOString().slice(0, 10),
        durationYears:    1,
        value:            acceptedQuotation ? Number(acceptedQuotation.total) : 0,
        advancePayment:   0,
        totalInstalments: 0,
        status:           'ACTIVE',
        notes:            '',
      })
    }
  }, [open, agreement?.id, acceptedQuotation?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const startDate        = watch('startDate')
  const durationYears    = watch('durationYears')
  const statusValue      = watch('status')
  const value            = watch('value') || 0
  const advancePayment   = watch('advancePayment') || 0
  const totalInstalments = watch('totalInstalments') || 0

  const computedEndDate    = startDate ? addYears(startDate, durationYears) : ''
  const remaining          = Math.max(0, value - advancePayment)
  const instalmentAmount   = totalInstalments > 0 ? remaining / totalInstalments : 0

  const onSubmit = async (data: FormData) => {
    const endDate     = addYears(data.startDate, data.durationYears)
    const renewalDate = endDate
    const payload = {
      startDate:        data.startDate,
      endDate,
      renewalDate,
      value:            data.value,
      advancePayment:   data.advancePayment,
      totalInstalments: data.totalInstalments,
      status:           data.status,
      notes:            data.notes,
    }
    if (isEdit) {
      await api.put(`/agreements/${agreement!.id}`, payload)
    } else {
      await api.post('/agreements', { ...payload, schoolId })
    }
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md flex flex-col max-h-[90vh]">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{isEdit ? 'Edit Agreement' : 'New Agreement'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">

          {/* Start date + Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Start Date *</Label>
              <Input type="date" {...register('startDate')} />
              {errors.startDate && <p className="text-xs text-destructive">{errors.startDate.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Duration *</Label>
              <Select
                value={String(durationYears)}
                onValueChange={(v) => setValue('durationYears', Number(v))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y} {y === 1 ? 'Year' : 'Years'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {computedEndDate && (
            <p className="text-xs text-muted-foreground -mt-2">
              Ends on{' '}
              <span className="font-medium text-foreground">
                {new Date(computedEndDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </p>
          )}

          <Separator />

          {/* Value */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Annual Value (₹) *</Label>
              {acceptedQuotation && Number(acceptedQuotation.total) !== value && (
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => setValue('value', Number(acceptedQuotation.total))}
                >
                  Use quotation #{acceptedQuotation.id} ({formatCurrency(Number(acceptedQuotation.total))})
                </button>
              )}
              {acceptedQuotation && Number(acceptedQuotation.total) === value && (
                <span className="text-xs text-muted-foreground">From quotation #{acceptedQuotation.id}</span>
              )}
            </div>
            <Input type="number" min={0} {...register('value')} placeholder="e.g. 150000" />
            {errors.value && <p className="text-xs text-destructive">{errors.value.message}</p>}
          </div>

          {/* Advance + Instalments */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Advance Received (₹)</Label>
              <Input type="number" min={0} {...register('advancePayment')} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>No. of Instalments</Label>
              <Input type="number" min={0} {...register('totalInstalments')} placeholder="0" />
            </div>
          </div>

          {/* Auto-calculated breakdown */}
          {(advancePayment > 0 || totalInstalments > 0) && (
            <div className="rounded-md bg-muted/40 border px-4 py-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Value</span>
                <span className="font-medium">{formatCurrency(value)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Advance Received</span>
                <span className="font-medium text-green-600">− {formatCurrency(advancePayment)}</span>
              </div>
              <div className="flex justify-between border-t pt-1.5">
                <span className="text-muted-foreground">Remaining Balance</span>
                <span className="font-semibold">{formatCurrency(remaining)}</span>
              </div>
              {totalInstalments > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Per Instalment ({totalInstalments}×)</span>
                  <span className="font-semibold text-blue-600">{formatCurrency(Math.round(instalmentAmount))}</span>
                </div>
              )}
            </div>
          )}

          <Separator />

          {/* Status */}
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={statusValue}
              onValueChange={(v) => setValue('status', v as FormData['status'])}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="PENDING_RENEWAL">Pending Renewal</SelectItem>
                <SelectItem value="EXPIRED">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea {...register('notes')} rows={2} placeholder="Optional notes..." />
          </div>

          </div>{/* end scrollable area */}

          <DialogFooter className="flex-shrink-0 pt-4 border-t mt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Agreement'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
