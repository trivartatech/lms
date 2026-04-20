import { prisma } from '../config/prisma'
import { AppError } from '../middleware/error.middleware'
import { Decimal } from '@prisma/client/runtime/library'

function serializeTiers(tiers: any): string | null {
  if (!tiers) return null
  return typeof tiers === 'string' ? tiers : JSON.stringify(tiers)
}

function parseAddon(addon: any) {
  if (!addon) return addon
  return {
    ...addon,
    tiers: addon.tiers ? JSON.parse(addon.tiers) : null,
  }
}

export const addonsService = {
  async getAll() {
    const addons = await prisma.addon.findMany({ orderBy: { name: 'asc' } })
    return addons.map(parseAddon)
  },

  async getById(id: number) {
    const addon = await prisma.addon.findUnique({ where: { id } })
    if (!addon) throw new AppError(404, 'Add-on not found')
    return parseAddon(addon)
  },

  async create(data: { name: string; description?: string; price: number; category?: string; tiers?: any }) {
    const { tiers, ...rest } = data
    const addon = await prisma.addon.create({
      data: { ...rest, price: new Decimal(data.price), tiers: serializeTiers(tiers) },
    })
    return parseAddon(addon)
  },

  async update(id: number, data: { name?: string; description?: string; price?: number; category?: string; tiers?: any }) {
    const addon = await prisma.addon.findUnique({ where: { id } })
    if (!addon) throw new AppError(404, 'Add-on not found')
    const { tiers, ...rest } = data
    const updateData: any = { ...rest }
    if (data.price !== undefined) updateData.price = new Decimal(data.price)
    if (tiers !== undefined) updateData.tiers = serializeTiers(tiers)
    const updated = await prisma.addon.update({ where: { id }, data: updateData })
    return parseAddon(updated)
  },

  async remove(id: number) {
    const addon = await prisma.addon.findUnique({ where: { id } })
    if (!addon) throw new AppError(404, 'Add-on not found')
    await prisma.addon.delete({ where: { id } })
  },
}
