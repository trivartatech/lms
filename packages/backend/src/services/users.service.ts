import bcrypt from 'bcryptjs'
import { prisma } from '../config/prisma'
import { AppError } from '../middleware/error.middleware'

export const usersService = {
  async getAll() {
    return prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true, updatedAt: true },
      orderBy: { name: 'asc' },
    })
  },

  async getById(id: number) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true, createdAt: true, updatedAt: true },
    })
    if (!user) throw new AppError(404, 'User not found')
    return user
  },

  async create(data: { name: string; email: string; password: string; role: string }) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } })
    if (existing) throw new AppError(409, 'Email already in use')

    const passwordHash = await bcrypt.hash(data.password, 12)
    return prisma.user.create({
      data: { name: data.name, email: data.email, passwordHash, role: data.role as any },
      select: { id: true, name: true, email: true, role: true, createdAt: true, updatedAt: true },
    })
  },

  async update(id: number, data: { name?: string; email?: string; password?: string; role?: string }) {
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) throw new AppError(404, 'User not found')

    const updateData: any = {}
    if (data.name) updateData.name = data.name
    if (data.email) updateData.email = data.email
    if (data.role) updateData.role = data.role
    if (data.password) updateData.passwordHash = await bcrypt.hash(data.password, 12)

    return prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, createdAt: true, updatedAt: true },
    })
  },

  async changePassword(id: number, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) throw new AppError(404, 'User not found')
    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) throw new AppError(400, 'Current password is incorrect')
    const passwordHash = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({ where: { id }, data: { passwordHash } })
    return { message: 'Password changed successfully' }
  },

  async remove(id: number) {
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) throw new AppError(404, 'User not found')
    await prisma.user.delete({ where: { id } })
  },
}
