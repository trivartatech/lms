
import { Prisma } from '@prisma/client'
import { prisma } from '../config/prisma'
import { AppError } from '../middleware/error.middleware'
import { apiNumbers } from '../lib/api-numbers'

const configuredLimit = Number(process.env.QUOTATION_APPROVAL_PERCENT ?? 10)
export const discountLimit = Number.isFinite(configuredLimit) && configuredLimit >= 0 && configuredLimit <= 100 ? configuredLimit : 10

export const quotationDetails = {
  items: { orderBy: { id: 'asc' } },
  lead: { select: { id: true, schoolName: true, contactPerson: true, phone: true, email: true, location: true, totalStudents: true } },
  school: { select: { id: true, name: true, contactPerson: true, phone: true, email: true, location: true, totalStudents: true } },
} satisfies Prisma.QuotationInclude

type Quote = Prisma.QuotationGetPayload<{ include: typeof quotationDetails }>
type VersionEvent = 'BASELINE' | 'REVISION' | 'SENT' | 'EMAIL' | 'WHATSAPP' | 'SHARED' | 'ACCEPTED'
const sentEvents = ['SENT', 'EMAIL', 'WHATSAPP', 'SHARED', 'ACCEPTED']

export function requiresApproval(quote: Pick<Quote, 'discount' | 'subtotal'>) {
  return quote.subtotal.greaterThan(0) && quote.discount.mul(100).greaterThan(quote.subtotal.mul(discountLimit))
}

export function assertDispatchAllowed(quote: Pick<Quote, 'discount' | 'subtotal' | 'approvalStatus'>) {
  if (requiresApproval(quote) && quote.approvalStatus !== 'APPROVED') {
    throw new AppError(409, 'A manager must approve this discount before the quotation can be sent.')
  }
}

export async function recordQuotationVersion(tx: Prisma.TransactionClient, quote: Quote, event: VersionEvent, userId: number, pdfBase64?: string) {
  const previous = await tx.quotationVersion.aggregate({ where: { quotationId: quote.id }, _max: { number: true } })
  return tx.quotationVersion.create({
    data: {
      quotationId: quote.id, number: (previous._max.number ?? 0) + 1, event, createdById: userId,
      snapshot: JSON.stringify({ quotation: apiNumbers(quote), ...(pdfBase64 ? { pdfBase64 } : {}) }),
    },
    select: { id: true, number: true, event: true, createdAt: true },
  })
}

export const quotationWorkflow = {
  async info(id: number) {
    const quote = await prisma.quotation.findUnique({
      where: { id },
      select: {
        id: true, discount: true, subtotal: true, approvalStatus: true, approvedById: true, approvedAt: true,
        versions: { select: { id: true, number: true, event: true, createdAt: true }, orderBy: { number: 'desc' } },
      },
    })
    if (!quote) throw new AppError(404, 'Quotation not found')
    return { requiresApproval: requiresApproval(quote), discountLimit, approvalStatus: quote.approvalStatus,
      approvedById: quote.approvedById, approvedAt: quote.approvedAt, versions: quote.versions }
  },

  async version(id: number, versionId: number) {
    const version = await prisma.quotationVersion.findFirst({ where: { id: versionId, quotationId: id } })
    if (!version) throw new AppError(404, 'Quotation version not found')
    const { snapshot, ...meta } = version
    const { quotation, pdfBase64 } = JSON.parse(snapshot)
    const aboveLimit = requiresApproval({ subtotal: new Prisma.Decimal(quotation.subtotal), discount: new Prisma.Decimal(quotation.discount) })
    const canExport = sentEvents.includes(version.event) || !aboveLimit || quotation.approvalStatus === 'APPROVED'
    return { ...meta, quotation, canExport, pdfBase64: canExport ? pdfBase64 : undefined }
  },

  async request(id: number) {
    const quote = await prisma.quotation.findUnique({ where: { id } })
    if (!quote) throw new AppError(404, 'Quotation not found')
    if (!requiresApproval(quote)) throw new AppError(400, 'This discount is within the approval limit')
    if (quote.approvalStatus === 'PENDING' || quote.approvalStatus === 'APPROVED') return { approvalStatus: quote.approvalStatus }
    const result = await prisma.quotation.updateMany({
      where: { id, updatedAt: quote.updatedAt },
      data: { approvalStatus: 'PENDING', approvedById: null, approvedAt: null },
    })
    if (!result.count) throw new AppError(409, 'Quotation changed. Refresh and request approval again.')
    return { approvalStatus: 'PENDING' }
  },

  async decide(id: number, approved: boolean, userId: number, reviewedAt: string) {
    const approvalStatus = approved ? 'APPROVED' : 'REJECTED'
    const result = await prisma.quotation.updateMany({
      where: { id, approvalStatus: 'PENDING', updatedAt: new Date(reviewedAt) },
      data: { approvalStatus, approvedById: userId, approvedAt: new Date() },
    })
    if (!result.count) throw new AppError(409, 'The approval request changed. Refresh the quotation before deciding.')
    return { approvalStatus }
  },

  async shared(id: number, expectedUpdatedAt: string, userId: number) {
    return prisma.$transaction(async tx => {
      const quote = await tx.quotation.findUnique({ where: { id }, include: quotationDetails })
      if (!quote) throw new AppError(404, 'Quotation not found')
      if (quote.updatedAt.toISOString() !== expectedUpdatedAt) throw new AppError(409, 'Quotation changed. Refresh before sharing.')
      // Issued quotations from before discount approvals can still be exported for reference.
      const previouslyIssued = ['SENT', 'ACCEPTED'].includes(quote.status) && quote.approvalStatus === 'NONE'
      if (!previouslyIssued) assertDispatchAllowed(quote)
      return recordQuotationVersion(tx, quote, 'SHARED', userId)
    })
  },

  async dispatched(quote: Quote, event: 'EMAIL' | 'WHATSAPP', userId: number, pdfBase64?: string) {
    return prisma.$transaction(async tx => {
      const sent = await tx.quotation.updateMany({
        where: { id: quote.id, updatedAt: quote.updatedAt, status: { in: ['DRAFT', 'SENT'] } },
        data: { status: 'SENT' },
      })
      await recordQuotationVersion(tx, { ...quote, status: sent.count ? 'SENT' : quote.status }, event, userId, pdfBase64)
    })
  },

  async remove(id: number) {
    const quote = await prisma.quotation.findUnique({
      where: { id }, include: { versions: { where: { event: { in: sentEvents } }, take: 1 } },
    })
    if (!quote) throw new AppError(404, 'Quotation not found')
    if (quote.versions.length || ['SENT', 'ACCEPTED'].includes(quote.status)) throw new AppError(409, 'Sent quotations are kept for reference')
    const result = await prisma.quotation.deleteMany({ where: { id, updatedAt: quote.updatedAt, versions: { none: { event: { in: sentEvents } } } } })
    if (!result.count) throw new AppError(409, 'Quotation changed. Refresh and try again.')
  },
}
