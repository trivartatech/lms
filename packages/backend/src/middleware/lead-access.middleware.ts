import { Request, Response, NextFunction } from 'express'
import { prisma } from '../config/prisma'
import { AppError } from './error.middleware'

export async function leadAccess(req: Request, _res: Response, next: NextFunction) {
  try {
    if (req.user.role !== 'SALES_EXECUTIVE') return next()
    const segment = req.path.split('/')[1]
    if (segment === 'bulk') throw new AppError(403, 'Bulk changes require a manager')
    if (segment && segment !== 'import') {
      const id = Number(segment)
      if (!Number.isSafeInteger(id) || id <= 0) throw new AppError(400, 'Invalid lead ID')
      const lead = await prisma.lead.findUnique({ where: { id } })
      if (!lead || lead.assignedToId !== req.user.id) throw new AppError(404, 'Lead not found')
    }
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && segment !== 'import') {
      if (req.body.assignedToId !== undefined && req.body.assignedToId !== req.user.id) {
        throw new AppError(403, 'Only a manager can reassign leads')
      }
      if (req.body.assignedTo !== undefined) throw new AppError(403, 'Only a manager can reassign leads')
      if (!segment || req.path.endsWith('/referrals')) req.body.assignedToId = req.user.id
    }
    next()
  } catch (error) { next(error) }
}
