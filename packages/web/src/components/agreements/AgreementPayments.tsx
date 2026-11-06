import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { localDateInput, type AgreementPayments as Payments } from '@lms/shared'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatCurrency, formatDate } from '@/lib/utils'

const paymentCurrency = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)

export function AgreementPayments({ agreementId }: { agreementId: number }) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState(localDateInput(new Date()))
  const [reference, setReference] = useState('')
  const [received, setReceived] = useState(false)
  const requestKey = useRef(crypto.randomUUID())
  useEffect(() => { requestKey.current = crypto.randomUUID() }, [amount, dueDate, reference, received])
  const qc = useQueryClient()
  const key = ['agreement-payments', agreementId]
  const { data, isLoading, isError } = useQuery<Payments>({ queryKey: key, enabled: open, queryFn: () => api.get(`/agreements/${agreementId}/payments`).then(r => r.data) })
  const refresh = () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ['agreements'] }) }
  const add = useMutation({ mutationFn: () => api.post(`/agreements/${agreementId}/payments`, { amount: Number(amount), dueDate, reference, paidAt: received ? new Date().toISOString() : undefined }, { headers: { 'Idempotency-Key': requestKey.current } }), onSuccess: () => { requestKey.current = crypto.randomUUID(); setAmount(''); setReference(''); refresh() } })
  const update = useMutation({ mutationFn: ({ id, remove }: { id: number; remove?: boolean }) => remove ? api.delete(`/agreements/${agreementId}/payments/${id}`) : api.put(`/agreements/${agreementId}/payments/${id}/receive`), onSuccess: refresh })
  return <>
    <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Payments</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Agreement #{agreementId} payments</DialogTitle></DialogHeader>
      {isLoading ? <p>Loading payments…</p> : isError ? <p role="alert">Unable to load payments. Close and try again.</p> : data && <>
        <div className="grid grid-cols-3 gap-3 text-sm"><div>Advance<br />{paymentCurrency(data.advance)}</div><div>Total received<br />{paymentCurrency(data.received)}</div><div>Outstanding<br /><strong>{paymentCurrency(data.outstanding)}</strong></div></div>
        <p className="text-xs text-muted-foreground">The advance is included in total received. Add only later payments or scheduled instalments.</p>
        {data.payments.length === 0 && <p>No instalments recorded yet.</p>}
        <div className="space-y-2">{data.payments.map(p => <div key={p.id} className="border rounded p-3 text-sm flex flex-wrap items-center justify-between gap-2">
          <div><strong>{paymentCurrency(p.amount)}</strong> · Due {formatDate(p.dueDate)}<br />{p.paidAt ? `Received ${formatDate(p.paidAt)}` : new Date(p.dueDate) < new Date(localDateInput(new Date()) + 'T00:00:00') ? 'Overdue' : 'Scheduled'}{p.reference && ` · ${p.reference}`}</div>
          {!p.paidAt && <div className="flex gap-2"><Button size="sm" disabled={update.isPending} onClick={() => { if (window.confirm('Confirm this instalment has been received?')) update.mutate({ id: p.id }) }}>Mark received</Button><Button size="sm" variant="outline" disabled={update.isPending} onClick={() => { if (window.confirm('Remove this unpaid instalment?')) update.mutate({ id: p.id, remove: true }) }}>Remove</Button></div>}
        </div>)}</div>
        <form className="space-y-3 border-t pt-3" onSubmit={event => { event.preventDefault(); add.mutate() }}>
          <p className="text-sm">Unscheduled balance: {paymentCurrency(data.unscheduled)}</p>
          <label className="block text-sm">Amount (₹)<input className="border rounded p-2 w-full" required type="number" min="0.01" step="0.01" max={data.unscheduled} value={amount} onChange={e => setAmount(e.target.value)} /></label>
          <label className="block text-sm">Due date<input className="border rounded p-2 w-full" type="date" required value={dueDate} onChange={e => setDueDate(e.target.value)} /></label>
          <label className="block text-sm">Reference (optional)<input className="border rounded p-2 w-full" maxLength={200} value={reference} onChange={e => setReference(e.target.value)} /></label>
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={received} onChange={e => setReceived(e.target.checked)} />Already received today</label>
          <Button type="submit" disabled={add.isPending || data.unscheduled <= 0}>{add.isPending ? 'Saving…' : received ? 'Record payment' : 'Schedule instalment'}</Button>
        </form>
      </>}
    </DialogContent></Dialog>
  </>
}
