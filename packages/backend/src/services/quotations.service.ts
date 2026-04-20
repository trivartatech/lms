import { prisma } from '../config/prisma'
import { AppError } from '../middleware/error.middleware'
import { timelineService } from './timeline.service'
import { Decimal } from '@prisma/client/runtime/library'

export const quotationsService = {
  async getAll(params: { leadId?: number; schoolId?: number }) {
    return prisma.quotation.findMany({
      where: params,
      include: {
        items: true,
        lead: { select: { id: true, schoolName: true, contactPerson: true, phone: true, email: true, location: true, totalStudents: true } },
        school: { select: { id: true, name: true, contactPerson: true, phone: true, email: true, location: true, totalStudents: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  },

  async getById(id: number) {
    const q = await prisma.quotation.findUnique({
      where: { id },
      include: {
        items: true,
        lead: { select: { id: true, schoolName: true, contactPerson: true, phone: true, email: true, location: true, totalStudents: true } },
        school: { select: { id: true, name: true, contactPerson: true, phone: true, email: true, location: true, totalStudents: true } },
      },
    })
    if (!q) throw new AppError(404, 'Quotation not found')
    return q
  },

  async create(
    data: {
      leadId?: number
      schoolId?: number
      discount?: number
      tax?: number
      items: { name: string; type: string; quantity: number; unitPrice: number }[]
    },
    userId: number,
  ) {
    const subtotal = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
    const discountAmount = data.discount ?? 0
    const taxAmount = data.tax ?? 0
    const total = subtotal - discountAmount + taxAmount

    const quotation = await prisma.quotation.create({
      data: {
        leadId: data.leadId,
        schoolId: data.schoolId,
        subtotal: new Decimal(subtotal),
        discount: new Decimal(discountAmount),
        tax: new Decimal(taxAmount),
        total: new Decimal(total),
        items: {
          create: data.items.map((item) => ({
            name: item.name,
            type: item.type,
            quantity: item.quantity,
            unitPrice: new Decimal(item.unitPrice),
            total: new Decimal(item.quantity * item.unitPrice),
          })),
        },
      },
      include: { items: true },
    })

    if (data.leadId) {
      await timelineService.logEvent({
        leadId: data.leadId,
        eventType: 'QUOTATION_CREATED',
        description: `Quotation #${quotation.id} created (Total: ${total})`,
        createdById: userId,
      })
    }
    if (data.schoolId) {
      await timelineService.logEvent({
        schoolId: data.schoolId,
        eventType: 'QUOTATION_CREATED',
        description: `Quotation #${quotation.id} created (Total: ${total})`,
        createdById: userId,
      })
    }

    return quotation
  },

  async update(
    id: number,
    data: {
      discount?: number
      tax?: number
      status?: string
      items?: { name: string; type: string; quantity: number; unitPrice: number }[]
    },
    userId: number,
  ) {
    const existing = await prisma.quotation.findUnique({ where: { id }, include: { items: true } })
    if (!existing) throw new AppError(404, 'Quotation not found')

    const updateData: any = {}
    if (data.status) updateData.status = data.status

    if (data.items) {
      const subtotal = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
      const discountAmount = data.discount ?? Number(existing.discount)
      const taxAmount = data.tax ?? Number(existing.tax)
      const total = subtotal - discountAmount + taxAmount

      updateData.subtotal = new Decimal(subtotal)
      updateData.discount = new Decimal(discountAmount)
      updateData.tax = new Decimal(taxAmount)
      updateData.total = new Decimal(total)
      updateData.items = {
        deleteMany: {},
        create: data.items.map((item) => ({
          name: item.name,
          type: item.type,
          quantity: item.quantity,
          unitPrice: new Decimal(item.unitPrice),
          total: new Decimal(item.quantity * item.unitPrice),
        })),
      }
    } else if (data.discount !== undefined || data.tax !== undefined) {
      const subtotal = Number(existing.subtotal)
      const discountAmount = data.discount ?? Number(existing.discount)
      const taxAmount = data.tax ?? Number(existing.tax)
      updateData.discount = new Decimal(discountAmount)
      updateData.tax = new Decimal(taxAmount)
      updateData.total = new Decimal(subtotal - discountAmount + taxAmount)
    }

    const quotation = await prisma.quotation.update({
      where: { id },
      data: updateData,
      include: { items: true },
    })

    if (data.status === 'SENT' && existing.leadId) {
      await timelineService.logEvent({
        leadId: existing.leadId,
        eventType: 'QUOTATION_SENT',
        description: `Quotation #${id} sent to client`,
        createdById: userId,
      })
    }
    if (data.status === 'ACCEPTED') {
      const target = existing.leadId || existing.schoolId
      const field = existing.leadId ? 'leadId' : 'schoolId'
      if (target) {
        await timelineService.logEvent({
          [field]: target,
          eventType: 'QUOTATION_ACCEPTED',
          description: `Quotation #${id} accepted`,
          createdById: userId,
        })
      }
    }

    return quotation
  },

  async remove(id: number) {
    const q = await prisma.quotation.findUnique({ where: { id } })
    if (!q) throw new AppError(404, 'Quotation not found')
    await prisma.quotation.delete({ where: { id } })
  },
}
