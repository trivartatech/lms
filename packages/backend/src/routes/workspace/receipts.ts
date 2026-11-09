
import { existsSync } from 'node:fs'
import path from 'node:path'
import type { Readable } from 'node:stream'
import { Router } from 'express'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import type { WorkspacePage } from '@lms/shared'
import { prisma } from '../../config/prisma'
import { AppError } from '../../middleware/error.middleware'
import { decodeSchoolFile, schoolUpload } from '../../lib/school-file'
import { action, day, displayDate, displayMoney, field, finance, handle, id, money, onlyFinance, option, parse, schoolFilter, schoolName, schoolScope } from './common'

const router = Router()
const paymentInclude = {
  agreement: { include: { school: schoolName } },
  review: { include: { bankEntry: true, proofFile: { select: { id: true, name: true } } } },
} satisfies Prisma.AgreementPaymentInclude
const reference = z.string().trim().min(1).max(150).transform(s => s.toUpperCase())

router.get('/', handle(async (req, res) => {
  const schoolId = schoolFilter(req)
  const paymentId = parse(id.optional(), req.query.recordId)
  const payments = await prisma.agreementPayment.findMany({
    where: { id: paymentId, agreement: { schoolId, school: schoolScope(req.user) } },
    include: paymentInclude,
    orderBy: [{ paidAt: 'desc' }, { dueDate: 'asc' }],
  })
  const bank = finance(req.user) ? await prisma.bankEntry.findMany({ where: { review: null }, orderBy: { receivedAt: 'desc' } }) : []
  const groups: WorkspacePage['sections'] = [
    { title: 'Awaiting reconciliation', cards: [] }, { title: 'Matched payments', cards: [] }, { title: 'Scheduled payments', cards: [] },
  ]
  for (const payment of payments) {
    const review = payment.review
    const matched = !!review?.matchedAt
    const exact = bank.filter(entry => entry.amount.equals(payment.amount))
    const actions = []
    if (!matched) {
      actions.push(action('Attach reference or proof', '/workspace/receipts/' + payment.id + '/proof', [
        field('reference', 'Payment reference', 'text', { value: review?.reference ?? payment.reference ?? '' }),
        field('file', 'PDF or photo of payment proof', 'file'),
      ], 'PATCH'))
    }
    if (finance(req.user) && !matched && payment.paidAt && exact.length) {
      const suggested = exact.find(entry => entry.reference === (review?.reference ?? payment.reference ?? '').toUpperCase())
      actions.push({ ...action('Match bank entry', '/workspace/receipts/' + payment.id + '/match', [
        field('bankEntryId', 'Bank entry of the same amount', 'select', { required: true, value: suggested ? String(suggested.id) : '', options: exact.map(b => option(b.id, b.reference + ' · ' + displayDate(b.receivedAt) + ' · ' + displayMoney(b.amount))) }),
      ]), confirm: 'Confirm this bank entry belongs to this payment?' })
    }
    if (finance(req.user) && matched && !review?.receiptNumber) {
      actions.push({ ...action('Issue receipt', '/workspace/receipts/' + payment.id + '/issue'), confirm: 'Issue a receipt for this matched payment?' })
    }
    const links = []
    if (review?.proofFile) links.push({ label: 'Download proof', path: '/workspace/receipts/' + payment.id + '/proof', downloadName: review.proofFile.name })
    if (review?.receiptNumber) links.push({ label: 'Download receipt', path: '/workspace/receipts/' + payment.id + '/receipt', downloadName: review.receiptNumber + '.pdf' })
    groups[matched ? 1 : payment.paidAt ? 0 : 2].cards.push({
      id: String(payment.id), title: payment.agreement.school.name + ' · ' + displayMoney(payment.amount),
      subtitle: 'Payment #' + payment.id + ' · Agreement #' + payment.agreementId,
      badge: matched ? 'Matched' : payment.paidAt ? 'Unmatched' : 'Awaiting payment',
      lines: [
        (payment.paidAt ? 'Received · ' : 'Due · ') + displayDate(payment.paidAt ?? payment.dueDate),
        'Reference · ' + (review?.reference ?? payment.reference ?? 'Not attached'),
        ...(review?.bankEntry ? ['Bank entry · ' + review.bankEntry.reference] : []),
        ...(review?.receiptNumber ? ['Receipt · ' + review.receiptNumber] : []),
      ],
      actions, links,
    })
  }
  if (finance(req.user)) {
    groups.unshift({
      title: 'Bank entries',
      cards: [{
        id: 'bank-import', title: 'Record a bank credit',
        actions: [action('Add bank entry', '/workspace/receipts/bank', [
          field('reference', 'Bank reference', 'text', { required: true }),
          field('amount', 'Amount (₹)', 'number', { required: true }),
          field('receivedAt', 'Bank credit date', 'date', { required: true }),
        ])],
      }, ...bank.map(entry => ({
        id: 'bank-' + entry.id, title: entry.reference, subtitle: displayMoney(entry.amount) + ' · ' + displayDate(entry.receivedAt),
        badge: 'Unmatched bank entry',
      }))],
    })
  }
  res.json({ title: 'Receipts & reconciliation', description: 'Attach proof, match received payments to bank entries and issue receipts.', sections: groups } satisfies WorkspacePage)
}))

router.post('/bank', handle(async (req, res) => {
  onlyFinance(req.user)
  const body = parse(z.object({ reference, amount: money.refine(v => v > 0, 'Amount must be positive'), receivedAt: day }), req.body)
  const receivedAt = new Date(body.receivedAt)
  const entry = await prisma.bankEntry.upsert({
    where: { reference: body.reference }, update: {}, create: { ...body, receivedAt },
  })
  if (!entry.amount.equals(body.amount) || entry.receivedAt.getTime() !== receivedAt.getTime()) {
    throw new AppError(409, 'That bank reference already has a different amount or date')
  }
  res.status(201).json({ message: 'Bank entry saved' })
}))

router.patch('/:id/proof', handle(async (req, res) => {
  const paymentId = parse(id, req.params.id)
  const body = parse(z.object({ reference: reference.optional(), file: schoolUpload.optional() })
    .refine(v => !!v.reference || !!v.file, 'Add a reference or proof file'), req.body)
  const file = body.file ? decodeSchoolFile(body.file) : undefined
  await prisma.$transaction(async tx => {
    const payment = await tx.agreementPayment.findFirst({ where: { id: paymentId, agreement: { school: schoolScope(req.user) } }, include: paymentInclude })
    if (!payment) throw new AppError(404, 'Payment not found')
    if (payment.review?.matchedAt) throw new AppError(409, 'This payment has already been matched')
    const proof = file ? await tx.schoolFile.create({
      data: { ...file, schoolId: payment.agreement.schoolId, category: 'Payment proof', uploadedById: req.user.id }, select: { id: true },
    }) : null
    await tx.paymentReview.upsert({
      where: { paymentId }, create: { paymentId, reference: body.reference, proofFileId: proof?.id },
      update: { reference: body.reference, proofFileId: proof?.id },
    })
  })
  res.json({ message: 'Payment details attached' })
}))

router.get('/:id/proof', handle(async (req, res) => {
  const review = await prisma.paymentReview.findFirst({
    where: { paymentId: parse(id, req.params.id), payment: { agreement: { school: schoolScope(req.user) } } }, include: { proofFile: true },
  })
  const file = review?.proofFile
  if (!file) throw new AppError(404, 'Payment proof not found')
  res.set('Cache-Control', 'private, no-store').attachment(file.name).type(file.mimeType).send(Buffer.from(file.content))
}))

router.post('/:id/match', handle(async (req, res) => {
  onlyFinance(req.user)
  const paymentId = parse(id, req.params.id)
  const bankEntryId = parse(id, req.body.bankEntryId)
  await prisma.$transaction(async tx => {
    const [payment, entry] = await Promise.all([
      tx.agreementPayment.findUnique({ where: { id: paymentId }, include: { review: true, agreement: true } }),
      tx.bankEntry.findUnique({ where: { id: bankEntryId }, include: { review: true } }),
    ])
    if (!payment || !entry) throw new AppError(404, 'Payment or bank entry not found')
    if (payment.review?.bankEntryId === entry.id) return
    if (!payment.paidAt || payment.review?.matchedAt || entry.review) throw new AppError(409, 'Choose a received payment and an unmatched bank entry')
    if (!entry.amount.equals(payment.amount)) throw new AppError(400, 'Bank and payment amounts must match')
    const data = { bankEntryId, matchedById: req.user.id, matchedAt: new Date(), reference: entry.reference }
    await tx.paymentReview.upsert({ where: { paymentId }, create: { paymentId, ...data }, update: data })
    await tx.timelineEvent.create({ data: {
      schoolId: payment.agreement.schoolId, createdById: req.user.id, eventType: 'PAYMENT_MATCHED',
      description: 'Payment #' + paymentId + ' matched to bank reference ' + entry.reference,
    } })
  })
  res.json({ message: 'Payment matched' })
}))

router.post('/:id/issue', handle(async (req, res) => {
  onlyFinance(req.user)
  const paymentId = parse(id, req.params.id)
  const receiptNumber = 'LMS-R-' + String(paymentId).padStart(6, '0')
  await prisma.$transaction(async tx => {
    const review = await tx.paymentReview.findUnique({ where: { paymentId }, include: { payment: { include: { agreement: true } } } })
    if (!review?.matchedAt || !review.bankEntryId || !review.payment.paidAt) throw new AppError(409, 'Match the payment before issuing a receipt')
    if (review.receiptNumber) return
    await tx.paymentReview.update({ where: { paymentId }, data: { receiptNumber, receiptIssuedAt: new Date() } })
    await tx.timelineEvent.create({ data: {
      schoolId: review.payment.agreement.schoolId, createdById: req.user.id, eventType: 'RECEIPT_ISSUED', description: 'Issued receipt ' + receiptNumber,
    } })
  })
  res.json({ message: 'Receipt ' + receiptNumber + ' ready' })
}))

interface ReceiptDocument extends Readable {
  font(name: string): this
  fontSize(size: number): this
  text(value: string, x: number, y: number): this
  widthOfString(value: string): number
  addPage(): this
  end(): void
}
const PDFDocument = require('@react-pdf/pdfkit').default as new (options: { size: string }) => ReceiptDocument
const receiptFont = [
  path.resolve(__dirname, '../../../public/fonts/NotoSans.ttf'),
  path.resolve(__dirname, '../../../../web/public/fonts/NotoSans.ttf'),
].find(file => existsSync(file))

function receiptPdf(lines: string[]): Promise<Buffer> {
  const pdf = new PDFDocument({ size: 'A4' })
  if (receiptFont) pdf.font(receiptFont)
  const chunks: Buffer[] = []
  const result = new Promise<Buffer>((resolve, reject) => {
    pdf.on('data', (chunk: Buffer) => chunks.push(chunk))
    pdf.once('error', reject)
    pdf.once('end', () => resolve(Buffer.concat(chunks)))
  })
  pdf.fontSize(22).text('LMS Payment Receipt', 56, 56)
  pdf.fontSize(12)
  let y = 105
  function writeLine(text: string) {
    if (y > 765) { pdf.addPage(); y = 56 }
    pdf.text(text, 56, y)
    y += 18
  }
  for (const line of lines) {
    let remaining = ''
    for (const character of line.replace(/\s+/g, ' ')) {
      if (pdf.widthOfString(remaining + character) > 480) {
        writeLine(remaining)
        remaining = ''
      }
      remaining += character
    }
    writeLine(remaining)
    y += 7
  }
  pdf.end()
  return result
}

router.get('/:id/receipt', handle(async (req, res) => {
  const review = await prisma.paymentReview.findFirst({
    where: { paymentId: parse(id, req.params.id), payment: { agreement: { school: schoolScope(req.user) } }, receiptNumber: { not: null } },
    include: { payment: { include: paymentInclude } },
  })
  if (!review?.receiptNumber) throw new AppError(404, 'Receipt not found')
  const payment = review.payment
  const pdf = await receiptPdf([
    'Receipt: ' + review.receiptNumber, 'Issued: ' + displayDate(review.receiptIssuedAt),
    'School: ' + payment.agreement.school.name, 'Agreement: #' + payment.agreementId, 'Payment: #' + payment.id,
    'Amount received: INR ' + payment.amount.toFixed(2), 'Received: ' + displayDate(payment.paidAt),
    'Bank reference: ' + (review.reference ?? ''),
  ])
  res.set('Cache-Control', 'private, no-store').attachment(review.receiptNumber + '.pdf').type('application/pdf').send(pdf)
}))

export default router
