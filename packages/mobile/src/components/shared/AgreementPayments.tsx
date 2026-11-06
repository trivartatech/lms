import { useState, useRef, useEffect } from 'react'
import { View, Text, Pressable, Modal, ScrollView, TextInput, Switch, Alert } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { localDateInput, type AgreementPayments as Payments } from '@lms/shared'
import { api } from '@/lib/api'
import { uuidv4 } from '@/lib/uuid'
import { C } from '@/lib/colors'
import { formatCurrency, formatDate } from '@/lib/utils'
import { DatePickerField } from './DatePickerField'

const paymentCurrency = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)

export function AgreementPayments({ agreementId }: { agreementId: number }) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState(localDateInput(new Date()))
  const [reference, setReference] = useState('')
  const [received, setReceived] = useState(false)
  const requestKey = useRef(uuidv4())
  useEffect(() => { requestKey.current = uuidv4() }, [amount, dueDate, reference, received])
  const qc = useQueryClient()
  const key = ['agreement-payments', agreementId]
  const { data, isLoading, isError, refetch } = useQuery<Payments>({ queryKey: key, enabled: open, queryFn: () => api.get(`/agreements/${agreementId}/payments`).then(r => r.data) })
  const refresh = () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ['agreements'] }) }
  const onError = (e: any) => Alert.alert('Payment', e.response?.data?.message ?? 'Unable to save. Check your connection and try again.')
  const add = useMutation({ mutationFn: (v: { amount: number; dueDate: string; reference: string; paidAt?: string; key: string }) => {
    const { key, ...body } = v
    return api.post(`/agreements/${agreementId}/payments`, body, { headers: { 'Idempotency-Key': key } })
  }, onSuccess: () => { requestKey.current = uuidv4(); setAmount(''); setReference(''); refresh() }, onError })
  const update = useMutation({ mutationFn: ({ id, remove }: { id: number; remove?: boolean }) => remove ? api.delete(`/agreements/${agreementId}/payments/${id}`) : api.put(`/agreements/${agreementId}/payments/${id}/receive`), onSuccess: refresh, onError })
  const submit = () => {
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0 || !data || value > data.unscheduled) return Alert.alert('Amount', 'Enter a positive amount within the unscheduled balance.')
    add.mutate({ amount: value, dueDate, reference, paidAt: received ? new Date().toISOString() : undefined, key: requestKey.current })
  }
  const action = (id: number, remove = false) => Alert.alert(remove ? 'Remove unpaid instalment?' : 'Confirm payment received?', undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm', onPress: () => update.mutate({ id, remove }) }])
  return <>
    <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={{ paddingVertical: 10 }}><Text style={{ color: C.primary }}>Payments & balance</Text></Pressable>
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 48, paddingBottom: 80, gap: 16 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ fontSize: 20, fontWeight: '600' }}>Agreement #{agreementId} payments</Text><Pressable onPress={() => setOpen(false)}><Text style={{ color: C.primary }}>Close</Text></Pressable></View>
        {isLoading ? <Text>Loading payments…</Text> : isError ? <Pressable onPress={() => refetch()}><Text>Unable to load. Tap to retry.</Text></Pressable> : data && <>
          <Text>Advance: {paymentCurrency(data.advance)}</Text><Text>Total received: {paymentCurrency(data.received)}</Text><Text style={{ fontWeight: '700' }}>Outstanding: {paymentCurrency(data.outstanding)}</Text>
          <Text style={{ color: C.textSecondary }}>Advance is already included. Add only later payments or scheduled instalments.</Text>
          {!data.payments.length && <Text>No instalments recorded yet.</Text>}
          {data.payments.map(p => <View key={p.id} style={{ borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 12, gap: 8 }}>
            <Text style={{ fontWeight: '600' }}>{paymentCurrency(p.amount)} · Due {formatDate(p.dueDate)}</Text>
            <Text>{p.paidAt ? `Received ${formatDate(p.paidAt)}` : localDateInput(p.dueDate) < localDateInput(new Date()) ? 'Overdue' : 'Scheduled'}{p.reference ? ` · ${p.reference}` : ''}</Text>
            {!p.paidAt && <View style={{ flexDirection: 'row', gap: 24 }}><Pressable disabled={update.isPending} onPress={() => action(p.id)}><Text style={{ color: C.primary }}>Mark received</Text></Pressable><Pressable disabled={update.isPending} onPress={() => action(p.id, true)}><Text style={{ color: C.error }}>Remove</Text></Pressable></View>}
          </View>)}
          <Text>Unscheduled balance: {paymentCurrency(data.unscheduled)}</Text>
          <Text>Amount (₹)</Text><TextInput style={{ borderWidth: 1, borderColor: C.border, padding: 12, borderRadius: 6 }} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} accessibilityLabel="Payment amount" />
          <Text>Due date</Text><DatePickerField value={dueDate} onChange={setDueDate} />
          <Text>Reference (optional)</Text><TextInput style={{ borderWidth: 1, borderColor: C.border, padding: 12, borderRadius: 6 }} value={reference} onChangeText={setReference} maxLength={200} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Switch value={received} onValueChange={setReceived} /><Text>Already received today</Text></View>
          <Pressable disabled={add.isPending || data.unscheduled <= 0} onPress={submit} style={{ backgroundColor: C.primary, padding: 14, borderRadius: 8, opacity: add.isPending || data.unscheduled <= 0 ? 0.5 : 1 }}><Text style={{ color: '#fff', textAlign: 'center' }}>{add.isPending ? 'Saving…' : received ? 'Record payment' : 'Schedule instalment'}</Text></Pressable>
        </>}
      </ScrollView>
    </Modal>
  </>
}
