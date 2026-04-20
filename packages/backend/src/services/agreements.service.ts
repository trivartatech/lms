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
    const existing = await prisma.agreement.findUnique({ where: { id } })
    if (!existing) throw new AppError(404, 'Agreement not found')

    const updateData: any = { ...data }
    if (data.startDate)  updateData.startDate  = new Date(data.startDate)
    if (data.endDate)    updateData.endDate    = new Date(data.endDate)
    if (data.renewalDate) updateData.renewalDate = new Date(data.renewalDate)
    if (data.value !== undefined)          updateData.value          = new Decimal(data.value)
    if (data.advancePayment !== undefined) updateData.advancePayment = new Decimal(data.advancePayment)

    const agreement = await prisma.agreement.update({
      where: { id },
      data: updateData,
      include: { school: { select: { id: true, name: true } } },
    })

    const diff = computeDiff(
      existing as unknown as Record<string, unknown>,
      data as Record<string, unknown>,
    )

    if (data.status === 'ACTIVE' && existing.status !== 'ACTIVE') {
      await timelineService.logEvent({
        schoolId: existing.schoolId,
        eventType: 'AGREEMENT_RENEWED',
        description: `Agreement #${id} renewed`,
        createdById: userId,
        diff,
      })
    } else if (Object.keys(diff).length > 0) {
      await timelineService.logEvent({
        schoolId: existing.schoolId,
        eventType: 'AGREEMENT_UPDATED',
        description: `Agreement #${id} updated: ${Object.keys(diff).join(', ')}`,
        createdById: userId,
        diff,
      })
    }
    return agreement
  },
}
