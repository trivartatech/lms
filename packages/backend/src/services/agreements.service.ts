import { validateAgreement } from '../validators/agreement'
import { prisma } from '../config/prisma'
import { AppError } from '../middleware/error.middleware'
import { timelineService, computeDiff } from './timeline.service'
import { Decimal } from '@prisma/client/runtime/library'

export const agreementsService = {
  async getAll(params: { schoolId?: number }) {
    return prisma.agreement.findMany({
      where: params,
      include: {
        school: {
          select: {
            id: true, name: true, location: true, totalStudents: true, contactPerson: true, phone: true,
            schoolAddons: { include: { addon: { select: { id: true, name: true, description: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  },

  async getById(id: number) {
    const a = await prisma.agreement.findUnique({
      where: { id },
      include: {
        school: {
          select: {
            id: true, name: true, location: true, totalStudents: true, contactPerson: true, phone: true,
            schoolAddons: { include: { addon: { select: { id: true, name: true, description: true } } } },
          },
        },
      },
    })
    if (!a) throw new AppError(404, 'Agreement not found')
    return a
  },

  async create(
    data: {
      schoolId:        number
      startDate:       string
      endDate:         string
      renewalDate?:    string
      value:           number
      advancePayment?: number
      totalInstalments?: number
      notes?:          string
    },
    userId: number,
  ) {
    validateAgreement(data)
    const agreement = await prisma.agreement.create({
      data: {
        schoolId:        data.schoolId,
        startDate:       new Date(data.startDate),
        endDate:         new Date(data.endDate),
        renewalDate:     data.renewalDate ? new Date(data.renewalDate) : null,
        value:           new Decimal(data.value),
        advancePayment:  new Decimal(data.advancePayment ?? 0),
        totalInstalments: data.totalInstalments ?? 0,
        notes:           data.notes,
      },
      include: { school: { select: { id: true, name: true } } },
    })
    await timelineService.logEvent({
      schoolId: data.schoolId,
      eventType: 'AGREEMENT_CREATED',
      description: `Agreement created (${data.startDate} - ${data.endDate}) for ${agreement.value}`,
      createdById: userId,
    })
    return agreement
  },

  async update(
    id: number,
    data: {
      startDate?:       string
      endDate?:         string
      renewalDate?:     string
      status?:          string
      value?:           number
      advancePayment?:  number
      totalInstalments?: number
      notes?:           string
    },
    userId: number,
  ) {
    return prisma.$transaction(async tx => {
    const existing = await tx.agreement.findUnique({ where: { id }, include: { payments: true } })
    if (!existing) throw new AppError(404, 'Agreement not found')

    validateAgreement({ ...existing, ...data })
    const allocated = existing.payments.reduce((sum, p) => sum.plus(p.amount), new Decimal(data.advancePayment ?? existing.advancePayment))
    if (allocated.greaterThan(data.value ?? existing.value)) throw new AppError(400, 'Agreement value cannot be less than its advance and scheduled payments')
    const updateData: any = { ...data }
    if (data.startDate)  updateData.startDate  = new Date(data.startDate)
    if (data.endDate)    updateData.endDate    = new Date(data.endDate)
    if (data.renewalDate !== undefined) updateData.renewalDate = data.renewalDate ? new Date(data.renewalDate) : null
    if (data.endDate && data.renewalDate === undefined && existing.renewalDate?.getTime() === existing.endDate.getTime()) updateData.renewalDate = new Date(data.endDate)
    if (data.value !== undefined)          updateData.value          = new Decimal(data.value)
    if (data.advancePayment !== undefined) updateData.advancePayment = new Decimal(data.advancePayment)

    const agreement = await tx.agreement.update({
      where: { id },
      data: updateData,
      include: { school: { select: { id: true, name: true } } },
    })

    const oldRenewal = existing.renewalDate ?? existing.endDate
    const newRenewal = agreement.renewalDate ?? agreement.endDate
    if (oldRenewal.getTime() !== newRenewal.getTime() || agreement.status === 'EXPIRED') {
      const reminders = await tx.agreementRenewalReminder.findMany({ where: { agreementId: id } })
      await tx.task.updateMany({ where: { id: { in: reminders.map(r => r.taskId) }, status: 'PENDING' }, data: { status: 'CANCELLED' } })
    }
    const diff = computeDiff(
      existing as unknown as Record<string, unknown>,
      data as Record<string, unknown>,
    )

    if (data.status === 'ACTIVE' && existing.status !== 'ACTIVE') {
      await tx.timelineEvent.create({ data: {
        schoolId: existing.schoolId,
        eventType: 'AGREEMENT_RENEWED',
        description: `Agreement #${id} renewed`,
        createdById: userId,
        diff: JSON.stringify(diff),
      } })
    } else if (Object.keys(diff).length > 0) {
      await tx.timelineEvent.create({ data: {
        schoolId: existing.schoolId,
        eventType: 'AGREEMENT_UPDATED',
        description: `Agreement #${id} updated: ${Object.keys(diff).join(', ')}`,
        createdById: userId,
        diff: JSON.stringify(diff),
      } })
    }
    return agreement
    })
  },
}
