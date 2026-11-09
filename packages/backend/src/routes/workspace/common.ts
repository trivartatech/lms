
import type { Request, Response, NextFunction } from 'express'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import type { WorkspaceAction, WorkspaceField } from '@lms/shared'
import { prisma } from '../../config/prisma'
import type { JwtPayload } from '../../middleware/auth.middleware'
import { AppError } from '../../middleware/error.middleware'

export const id = z.coerce.number().int().positive().max(2147483647)
export const note = z.string().trim().max(4000)
export const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => {
  const date = new Date(s)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === s
}, 'Enter a valid date')
export const timestamp = z.string().datetime({ offset: true })
export const money = z.coerce.number().finite().min(0).max(1e10).refine(n => new Prisma.Decimal(n).decimalPlaces() <= 2, 'Use up to two decimal places')
export const person = { select: { id: true, name: true } } satisfies Prisma.UserDefaultArgs
export const schoolName = { select: { id: true, name: true } } satisfies Prisma.SchoolDefaultArgs
export const indiaOffset = 330 * 60_000

export function indiaDay(date = new Date()) {
  return new Date(date.getTime() + indiaOffset).toISOString().slice(0, 10)
}

export function indiaMidnight(date = new Date()) {
  return new Date(new Date(indiaDay(date)).getTime() - indiaOffset)
}

export function displayDate(date: Date | null | undefined) {
  return date ? date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium' }) : 'Not set'
}

export function displayMoney(value: Prisma.Decimal | number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(value))
}

export function manager(user: JwtPayload) {
  return ['ADMIN', 'SALES_MANAGER'].includes(user.role)
}

export function finance(user: JwtPayload) {
  return user.role === 'ADMIN' || user.role === 'FINANCE'
}

export function schoolScope(user: JwtPayload): Prisma.SchoolWhereInput {
  return user.role === 'SALES_EXECUTIVE' ? { assignedToId: user.id } : {}
}

export function workScope(user: JwtPayload): Prisma.SchoolWorkWhereInput {
  if (user.role === 'SUPPORT') return { kind: 'support', assignedToId: user.id }
  if (user.role === 'SALES_EXECUTIVE') return { OR: [{ assignedToId: user.id }, { school: schoolScope(user) }] }
  return {}
}

export function timelineScope(user: JwtPayload): Prisma.SchoolWhereInput {
  return user.role === 'SUPPORT' ? { work: { some: workScope(user) } } : schoolScope(user)
}

export function onlyManager(user: JwtPayload) {
  if (!manager(user)) throw new AppError(403, 'A sales manager must perform this action')
}

export function onlyFinance(user: JwtPayload) {
  if (!finance(user)) throw new AppError(403, 'Finance must perform this action')
}

export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) throw new AppError(400, result.error.issues[0].message)
  return result.data
}

export function schoolFilter(req: Request) {
  return parse(id.optional(), req.query.schoolId)
}

export async function schoolFor(user: JwtPayload, schoolId: number) {
  const school = await prisma.school.findFirst({ where: { id: schoolId, ...schoolScope(user) }, select: { id: true, name: true } })
  if (!school) throw new AppError(404, 'School not found')
  return school
}

export async function assignees() {
  return prisma.user.findMany({
    where: { role: { in: ['SALES_EXECUTIVE', 'SALES_MANAGER', 'ADMIN'] } },
    select: person.select, orderBy: { name: 'asc' },
  })
}

export function handle(fn: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(error => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2028', 'P2034'].includes(error.code)) {
        next(new AppError(409, 'This record changed. Refresh and try again.'))
      } else next(error)
    })
  }
}

export const option = (value: string | number, label: string) => ({ value: String(value), label })
export function field(name: string, label: string, kind: WorkspaceField['kind'], details: Omit<WorkspaceField, 'name' | 'label' | 'kind'> = {}): WorkspaceField {
  return { name, label, kind, ...details }
}
export const action = (label: string, path: string, fields?: WorkspaceField[], method?: WorkspaceAction['method']): WorkspaceAction =>
  ({ label, path, fields, method })
