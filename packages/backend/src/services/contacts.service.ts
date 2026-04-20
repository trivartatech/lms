import { prisma } from '../config/prisma'
import { AppError } from '../middleware/error.middleware'

export const contactsService = {
  async getBySchool(schoolId: number) {
    return prisma.contact.findMany({
      where: { schoolId },
      orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
    })
  },

  async getByLead(leadId: number) {
    return prisma.contact.findMany({
      where: { leadId },
      orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
    })
  },

  async create(data: {
    name: string
    phone: string
    email?: string
    designation?: string
    isPrimary?: boolean
    schoolId?: number
    leadId?: number
  }) {
    return prisma.contact.create({ data })
  },

  async update(id: number, data: {
    name?: string
    phone?: string
    email?: string
    designation?: string
    isPrimary?: boolean
  }) {
    const contact = await prisma.contact.findUnique({ where: { id } })
    if (!contact) throw new AppError(404, 'Contact not found')
    return prisma.contact.update({ where: { id }, data })
  },

  async remove(id: number) {
    const contact = await prisma.contact.findUnique({ where: { id } })
    if (!contact) throw new AppError(404, 'Contact not found')
    return prisma.contact.delete({ where: { id } })
  },
}
