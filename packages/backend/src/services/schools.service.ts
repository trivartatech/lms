import { prisma } from '../config/prisma'
import { AppError } from '../middleware/error.middleware'
import { timelineService, computeDiff } from './timeline.service'

const schoolInclude = {
  referredBySchool: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, name: true, email: true, role: true } },
}

export const schoolsService = {
  async getAll(params: { search?: string; page?: number; limit?: number }) {
    const { page = 1, limit = 20, search } = params
    const skip = (page - 1) * limit
    const where: any = {}
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { contactPerson: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ]
    }
    const [data, total] = await Promise.all([
      prisma.school.findMany({ where, include: schoolInclude, orderBy: { name: 'asc' }, skip, take: limit }),
      prisma.school.count({ where }),
    ])
    return { data, total, page, limit }
  },

  async getById(id: number) {
    const school = await prisma.school.findUnique({ where: { id }, include: schoolInclude })
    if (!school) throw new AppError(404, 'School not found')
    return school
  },

  async create(data: any) {
    const school = await prisma.school.create({ data, include: schoolInclude })
    await prisma.contact.create({
      data: {
        name: school.contactPerson,
        phone: school.phone,
        email: school.email ?? undefined,
        isPrimary: true,
        schoolId: school.id,
      },
    })
    return school
  },

  async update(id: number, data: any, userId?: number) {
    const existing = await prisma.school.findUnique({ where: { id } })
    if (!existing) throw new AppError(404, 'School not found')

    const updated = await prisma.school.update({ where: { id }, data, include: schoolInclude })

    const diff = computeDiff(
      existing as unknown as Record<string, unknown>,
      data as Record<string, unknown>,
    )
    if (Object.keys(diff).length > 0) {
      await timelineService.logEvent({
        schoolId: id,
        eventType: 'SCHOOL_UPDATED',
        description: `Updated: ${Object.keys(diff).join(', ')}`,
        createdById: userId,
        diff,
      })
    }
    return updated
  },

  async getAgreements(schoolId: number) {
    return prisma.agreement.findMany({
      where: { schoolId },
      orderBy: { createdAt: 'desc' },
    })
  },

  async getAddons(schoolId: number) {
    return prisma.schoolAddon.findMany({
      where: { schoolId },
      include: { addon: true },
    })
  },

  async addAddon(schoolId: number, data: { addonId: number; price: number; startDate: string }) {
    return prisma.schoolAddon.create({
      data: { schoolId, addonId: data.addonId, price: data.price, startDate: new Date(data.startDate) },
      include: { addon: true },
    })
  },

  async removeAddon(schoolId: number, addonId: number) {
    const existing = await prisma.schoolAddon.findFirst({ where: { schoolId, addonId } })
    if (!existing) throw new AppError(404, 'Add-on not active for this school')
    return prisma.schoolAddon.delete({ where: { id: existing.id } })
  },

  async getTimeline(schoolId: number) {
    return prisma.timelineEvent.findMany({
      where: { schoolId },
      include: { createdBy: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: 'desc' },
    })
  },

  async getTasks(schoolId: number) {
    return prisma.task.findMany({
      where: { schoolId },
      include: { assignedTo: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { dueDate: 'asc' },
    })
  },
}
