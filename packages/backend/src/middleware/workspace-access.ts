
import type { Request, RequestHandler } from 'express'
import { ROLES } from '@lms/shared'
import type { Prisma } from '@prisma/client'
import { prisma } from '../config/prisma'
import { AppError } from './error.middleware'
import type { JwtPayload } from './auth.middleware'

export const executive = (user: JwtPayload) => user.role === 'SALES_EXECUTIVE'

export function quotationScope(user: JwtPayload): Prisma.QuotationWhereInput {
  return executive(user) ? { OR: [{ school: { assignedToId: user.id } }, { schoolId: null, lead: { assignedToId: user.id } }] } : {}
}

export function taskScope(user: JwtPayload): Prisma.TaskWhereInput {
  return executive(user) ? { OR: [{ assignedToId: user.id }, { school: { assignedToId: user.id } }, { lead: { assignedToId: user.id } }] } : {}
}

export const staffBoundary: RequestHandler = async (req, _res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { role: true } })
    if (!user) throw new AppError(401, 'Account not found')
    if (!Object.values(ROLES).some(role => role === user.role)) throw new AppError(403, 'Account role is unavailable')
    req.user.role = user.role
    const path = req.path.toLowerCase()
    const workspace = /^\/workspace(?:\/|$)/.test(path)
    const account = /^\/users\/me\/(password|push-token)\/?$/.test(path)
    if (user.role === 'FINANCE') {
      const agreements = /^\/agreements(?:\/|$)/.test(path)
      const payments = /^\/agreements\/\d+\/payments(?:\/|$)/.test(path)
      const operations = /^\/operations(?:\/|$)/.test(path)
      if (!(workspace || account || operations || (agreements && req.method === 'GET') || payments)) throw new AppError(403, 'Use the finance workspace for this account')
    } else if (user.role === 'SUPPORT') {
      const operations = /^\/operations(?:\/|$)/.test(path)
      if (!(workspace || account || operations)) throw new AppError(403, 'Use the support workspace for this account')
    }
    next()
  } catch (error) { next(error) }
}

export const supportBoundary: RequestHandler = (req, _res, next) => {
  const path = req.path.toLowerCase()
  if (req.user.role === 'FINANCE') {
    const read = req.method === 'GET' && /^\/(index|collections)\/?$/.test(path)
    const followUp = req.method === 'POST' && /^\/collections\/\d+\/follow-ups\/?$/.test(path)
    return read || followUp ? next() : next(new AppError(403, 'Finance operations are limited to collections'))
  }
  if (req.user.role !== 'SUPPORT') return next()
  const read = req.method === 'GET' && /^(\/index|\/work\/support|\/files\/\d+)\/?$/.test(path)
  const update = req.method === 'PATCH' && /^\/work\/\d+\/?$/.test(path)
  const attach = req.method === 'POST' && /^\/files\/?$/.test(path) && !!req.body?.workId
  const chat = ['GET', 'POST'].includes(req.method) && /^\/work\/\d+\/messages\/?$/.test(path)
  if (read || update || attach || chat) return next()
  next(new AppError(403, 'Support access is limited to assigned tickets'))
}

async function checkParents(req: Request) {
  const { schoolId, leadId } = req.body ?? {}
  if (schoolId != null && !await prisma.school.findFirst({ where: { id: Number(schoolId), assignedToId: req.user.id }, select: { id: true } })) {
    throw new AppError(404, 'School not found')
  }
  if (leadId != null && !await prisma.lead.findFirst({ where: { id: Number(leadId), assignedToId: req.user.id }, select: { id: true } })) {
    throw new AppError(404, 'Lead not found')
  }
}

type Entity = 'school' | 'quotation' | 'agreement' | 'task' | 'contact'

export function assignedRecord(entity: Entity): RequestHandler {
  return async (req, _res, next) => {
    if (!executive(req.user)) return next()
    try {
      const [segment, parentId] = req.path.split('/').filter(Boolean)
      const recordId = segment ? Number(segment) : undefined
      const userId = req.user.id
      if (entity === 'school' && req.method !== 'GET' && req.body?.assignedToId !== undefined && req.body.assignedToId !== userId) {
        throw new AppError(403, 'Only managers can reassign schools')
      }
      if (entity === 'school' && !segment && req.method === 'POST') req.body.assignedToId = userId
      if (entity === 'task' && req.method !== 'GET' && req.body?.assignedToId !== undefined && req.body.assignedToId !== userId) {
        throw new AppError(403, 'Only managers can reassign tasks')
      }
      if (entity === 'task' && !segment && req.method === 'POST') req.body.assignedToId = userId
      if (req.method !== 'GET') await checkParents(req)
      if (!segment) return next()
      let found = false
      if (entity === 'contact' && segment === 'school') {
        found = !!await prisma.school.findFirst({ where: { id: Number(parentId), assignedToId: userId }, select: { id: true } })
      } else if (entity === 'contact' && segment === 'lead') {
        found = !!await prisma.lead.findFirst({ where: { id: Number(parentId), assignedToId: userId }, select: { id: true } })
      } else if (Number.isSafeInteger(recordId) && recordId! > 0) {
        const select = { id: true } as const
        switch (entity) {
          case 'school': found = !!await prisma.school.findFirst({ where: { id: recordId, assignedToId: userId }, select }); break
          case 'quotation': found = !!await prisma.quotation.findFirst({ where: { id: recordId, ...quotationScope(req.user) }, select }); break
          case 'agreement': found = !!await prisma.agreement.findFirst({ where: { id: recordId, school: { assignedToId: userId } }, select }); break
          case 'task': found = !!await prisma.task.findFirst({ where: { id: recordId, ...taskScope(req.user) }, select }); break
          case 'contact': found = !!await prisma.contact.findFirst({ where: { id: recordId,
            OR: [{ school: { assignedToId: userId } }, { schoolId: null, lead: { assignedToId: userId } }] }, select }); break
        }
      }
      if (!found) throw new AppError(404, 'Record not found')
      next()
    } catch (error) { next(error) }
  }
}
