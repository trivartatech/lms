import { prisma } from '../config/prisma'
import { Decimal } from '@prisma/client/runtime/library'
import { AppError } from '../middleware/error.middleware'
import { z } from 'zod'

const paymentSchema = z.object({
  amount: z.number().finite().positive().refine(v => new Decimal(v).decimalPlaces() <= 2, 'Use at most two decimal places'),
  dueDate: z.string().refine(v => Number.isFinite(new Date(v).getTime()), 'Invalid due date'),
  paidAt: z.string().refine(v => Number.isFinite(new Date(v).getTime()) && new Date(v).getTime() <= Date.now(), 'Invalid received date').optional(),
  reference: z.string().trim().max(200).optional(),
})

export const agreementPaymentsService = {
  async get(agreementId: number) {
    const agreement = await prisma.agreement.findUnique({ where: { id: agreementId }, include: { payments: { orderBy: { dueDate: 'asc' } } } })
    if (!agreement) throw new AppError(404, 'Agreement not found')
    const paid = agreement.payments.filter(p => p.paidAt).reduce((sum, p) => sum.plus(p.amount), new Decimal(0))
    const scheduled = agreement.payments.reduce((sum, p) => sum.plus(p.amount), new Decimal(0))
    return {
      payments: agreement.payments, value: agreement.value, advance: agreement.advancePayment,
      received: paid.plus(agreement.advancePayment),
      outstanding: agreement.value.minus(agreement.advancePayment).minus(paid),
      unscheduled: agreement.value.minus(agreement.advancePayment).minus(scheduled),
    }
  },
  async add(agreementId: number, body: unknown, userId: number) {
    const parsed = paymentSchema.safeParse(body)
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message)
    const data = parsed.data
    return prisma.$transaction(async tx => {
      const agreement = await tx.agreement.findUnique({ where: { id: agreementId }, include: { payments: true } })
      if (!agreement) throw new AppError(404, 'Agreement not found')
      const allocated = agreement.payments.reduce((sum, p) => sum.plus(p.amount), new Decimal(agreement.advancePayment))
      if (allocated.plus(data.amount).greaterThan(agreement.value)) throw new AppError(400, 'Amount exceeds the unscheduled agreement balance. Mark an existing instalment received instead.')
      const payment = await tx.agreementPayment.create({ data: { agreementId, amount: data.amount, dueDate: new Date(data.dueDate), paidAt: data.paidAt ? new Date(data.paidAt) : null, reference: data.reference, createdById: userId } })
      await tx.timelineEvent.create({ data: { schoolId: agreement.schoolId, eventType: 'AGREEMENT_PAYMENT_ADDED', description: `Agreement #${agreementId}: ${data.paidAt ? 'received' : 'scheduled'} ${data.amount}`, createdById: userId } })
      return payment
    })
  },
  async receive(agreementId: number, id: number, userId: number) {
    return prisma.$transaction(async tx => {
      const payment = await tx.agreementPayment.findFirst({ where: { id, agreementId }, include: { agreement: true } })
      if (!payment) throw new AppError(404, 'Payment not found')
      if (payment.paidAt) return payment
      const result = await tx.agreementPayment.update({ where: { id }, data: { paidAt: new Date() } })
      await tx.timelineEvent.create({ data: { schoolId: payment.agreement.schoolId, eventType: 'AGREEMENT_PAYMENT_RECEIVED', description: `Agreement #${agreementId}: received ${payment.amount}`, createdById: userId } })
      return result
    })
  },
  async remove(agreementId: number, id: number) {
    const result = await prisma.agreementPayment.deleteMany({ where: { id, agreementId, paidAt: null } })
    if (!result.count) throw new AppError(400, 'Only unpaid scheduled instalments can be removed')
  },
}
