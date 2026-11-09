import { ticketChat } from './ticket-chat'
import { supportBoundary } from '../middleware/workspace-access'
import { schoolScope, workScope, timelineScope } from './workspace/common'
import { schoolUpload, decodeSchoolFile } from '../lib/school-file'

import { Router, type Request, type Response, type NextFunction } from 'express'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { DOCUMENT_CATEGORIES, WORK_STATUSES } from '@lms/shared'
import { prisma } from '../config/prisma'
import { authenticate, type JwtPayload } from '../middleware/auth.middleware'
import { idempotency } from '../middleware/idempotency.middleware'
import { AppError } from '../middleware/error.middleware'
import { apiNumbers } from '../lib/api-numbers'

const router = Router()
router.use(authenticate, supportBoundary)
router.use('/work/:id/messages', ticketChat(req => ({ id: req.user.id, type: 'STAFF', scope: workScope(req.user) })))
router.use(idempotency)

function handle(fn: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => { fn(req, res).catch(error => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2028', 'P2034'].includes(error.code)) {
      next(new AppError(409, 'A concurrent update prevented saving. Refresh and try again.'))
    } else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      next(new AppError(400, 'A selected record or assignee is no longer available.'))
    } else next(error)
  }) }
}

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body)
  if (!result.success) throw new AppError(400, result.error.issues[0].message)
  return result.data
}

const id = z.coerce.number().int().positive()
const date = z.string().datetime({ offset: true })
const title = z.string().trim().min(1).max(180)
const notes = z.string().trim().max(4000)
const person = { select: { id: true, name: true } } satisfies Prisma.UserDefaultArgs
const schoolSelect = {
  id: true, name: true, location: true, latitude: true, longitude: true, assignedTo: person,
} satisfies Prisma.SchoolSelect
const fileSelect = {
  id: true, schoolId: true, workId: true, name: true, mimeType: true, size: true, category: true, createdAt: true,
  school: { select: schoolSelect },
} satisfies Prisma.SchoolFileSelect
const workInclude = {
  school: { select: schoolSelect }, assignedTo: person, files: { select: fileSelect },
  events: { select: { id: true, status: true, notes: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 20 },
} satisfies Prisma.SchoolWorkInclude

function canAssign(user: JwtPayload) { return ['ADMIN', 'SALES_MANAGER'].includes(user.role) }

async function getSchool(user: JwtPayload, schoolId: number) {
  const school = await prisma.school.findFirst({ where: { id: schoolId, ...schoolScope(user) } })
  if (!school) throw new AppError(404, 'School not found')
  return school
}

const listSchema = z.object({ schoolId: id.optional(), assignedToId: id.optional() })
const workKind = z.enum(['visits', 'support', 'onboarding'])
const createSchema = z.object({
  schoolId: id, title, notes: notes.optional(), dueAt: date, assignedToId: id.optional(),
})
const updateSchema = z.object({
  expectedUpdatedAt: date.optional(),
  status: z.string().optional(), notes: notes.optional(), outcome: notes.optional(),
  dueAt: date.nullable().optional(), assignedToId: id.nullable().optional(),
  checkIn: z.literal(true).optional(), checkedInAt: date.optional(),
  latitude: z.number().min(-90).max(90).optional(), longitude: z.number().min(-180).max(180).optional(),
  followUp: z.object({ title, dueAt: date }).optional(),
}).refine(v => (v.latitude === undefined) === (v.longitude === undefined), 'Provide both coordinates')

router.get('/index', handle(async (req, res) => {
  const [schools, assignees, supportAssignees] = await Promise.all([
    prisma.school.findMany({ where: req.user.role === 'SUPPORT' ? timelineScope(req.user) : schoolScope(req.user), select: schoolSelect, orderBy: { name: 'asc' } }),
    prisma.user.findMany({ where: canAssign(req.user) ? {} : { id: req.user.id }, select: person.select, orderBy: { name: 'asc' } }),
    req.user.role === 'FINANCE' ? Promise.resolve([]) : prisma.user.findMany({
      where: { role: canAssign(req.user) ? { not: 'FINANCE' } : 'SUPPORT' }, select: person.select, orderBy: { name: 'asc' },
    }),
  ])
  res.json({ schools, assignees, supportAssignees, canAssign: canAssign(req.user) })
}))

router.get('/agreements/:schoolId', handle(async (req, res) => {
  const school = await getSchool(req.user, parse(id, req.params.schoolId))
  const agreements = await prisma.agreement.findMany({
    where: { schoolId: school.id, status: { in: ['ACTIVE', 'PENDING_RENEWAL'] } },
    select: { id: true, startDate: true, endDate: true, status: true },
    orderBy: { startDate: 'desc' },
  })
  res.json(agreements)
}))

router.post('/onboarding', handle(async (req, res) => {
  const { schoolId, agreementId } = parse(z.object({ schoolId: id, agreementId: id }), req.body)
  const school = await getSchool(req.user, schoolId)
  const agreement = await prisma.agreement.findFirst({ where: { id: agreementId, schoolId, status: { in: ['ACTIVE', 'PENDING_RENEWAL'] } } })
  if (!agreement) throw new AppError(400, 'Choose an active agreement for this school')
  const steps = [
    ['setup', 'Set up the school account'],
    ['data', 'Collect and import school data'],
    ['training', 'Train school staff'],
    ['go-live', 'Confirm go-live with the school'],
  ]
  const rows = await prisma.$transaction(steps.map(([templateKey, title]) =>
    prisma.schoolWork.upsert({
      where: { agreementId_templateKey: { agreementId, templateKey } },
      create: { schoolId, agreementId, templateKey, title, kind: 'onboarding', status: 'PENDING',
        assignedToId: school.assignedToId ?? req.user.id, createdById: req.user.id },
      update: {},
      include: workInclude,
    }),
  ))
  res.json(rows)
}))

router.get('/work/:kind', handle(async (req, res) => {
  const kind = parse(workKind, req.params.kind)
  const { schoolId, assignedToId } = parse(listSchema, req.query)
  const items = await prisma.schoolWork.findMany({
    where: { kind, schoolId, AND: [{ assignedToId }, workScope(req.user)] },
    include: { ...workInclude, messages: kind === 'support' ? {
      select: { senderType: true }, orderBy: { id: 'desc' }, take: 1,
    } : false },
    orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
  })
  res.json(items.map(({ messages, ...item }) => ({ ...item,
    ...(kind === 'support' ? { waitingForStaff: messages?.[0]?.senderType !== 'STAFF' } : {}),
  })))
}))

router.post('/work/:kind', handle(async (req, res) => {
  const kind = parse(z.enum(['visits', 'support']), req.params.kind)
  const { schoolId, dueAt, assignedToId, ...data } = parse(createSchema, req.body)
  const school = await getSchool(req.user, schoolId)
  if (assignedToId && assignedToId !== req.user.id && !canAssign(req.user)) throw new AppError(403, 'Only managers can assign another user')
  if (kind === 'support' && assignedToId && !await prisma.user.findFirst({
    where: { id: assignedToId, role: { not: 'FINANCE' } }, select: { id: true },
  })) throw new AppError(400, 'Choose an eligible ticket assignee')
  const work = await prisma.schoolWork.create({
    data: { ...data, schoolId, kind, status: kind === 'visits' ? 'PLANNED' : 'OPEN',
      dueAt: new Date(dueAt), assignedToId: assignedToId ?? school.assignedToId ?? req.user.id,
      createdById: req.user.id,
      events: { create: { status: kind === 'visits' ? 'PLANNED' : 'OPEN', notes: data.notes, createdById: req.user.id } } },
    include: workInclude,
  })
  res.status(201).json(work)
}))

router.patch('/work/:id', handle(async (req, res) => {
  const workId = parse(id, req.params.id)
  const input = parse(updateSchema, req.body)
  const work = await prisma.schoolWork.findFirst({
    where: { id: workId, ...workScope(req.user) },
  })
  if (!work || work.kind === 'collections') throw new AppError(404, 'Work item not found')
  if (input.expectedUpdatedAt && input.expectedUpdatedAt !== work.updatedAt.toISOString()) {
    throw new AppError(409, 'This item has changed. Review the latest record before applying your update.')
  }
  const statuses: readonly string[] | undefined = WORK_STATUSES[work.kind as keyof typeof WORK_STATUSES]
  if (input.status && (!statuses?.includes(input.status) || input.status === 'CHECKED_IN')) throw new AppError(400, 'Invalid status for this item')
  const handoff = input.assignedToId !== undefined && !canAssign(req.user)
  if (handoff && (work.kind !== 'support' || work.assignedToId !== req.user.id || !input.assignedToId)) {
    throw new AppError(403, 'You can hand off tickets assigned to you')
  }
  if (input.checkIn && (work.kind !== 'visits' || !['PLANNED', 'CHECKED_IN'].includes(work.status))) {
    throw new AppError(409, 'Only planned visits can be checked in')
  }
  if (input.checkedInAt && (!input.checkIn || Date.parse(input.checkedInAt) > Date.now() + 5 * 60_000)) throw new AppError(400, 'Invalid check-in time')
  if (input.followUp && work.kind !== 'visits') throw new AppError(400, 'Follow-up tasks are available for visits')
  if (input.status === 'BLOCKED' && !(input.notes ?? work.notes)?.trim()) throw new AppError(400, 'Add a note describing the blocker')
  if (work.kind === 'visits' && input.status === 'COMPLETED' && !(input.outcome ?? work.outcome)?.trim()) {
    throw new AppError(400, 'Add the visit outcome before completing it')
  }
  const updated = await prisma.$transaction(async tx => {
    const current = await tx.schoolWork.findUniqueOrThrow({ where: { id: work.id } })
    if (current.updatedAt.getTime() !== work.updatedAt.getTime()) throw new AppError(409, 'This item changed. Refresh it and retry.')
    const status = input.checkIn ? 'CHECKED_IN' : input.status ?? current.status
    const reassigned = input.assignedToId !== undefined && input.assignedToId !== current.assignedToId
    const changed = reassigned || status !== current.status || (input.notes !== undefined && input.notes !== current.notes)
    const assignee = reassigned && input.assignedToId ? await tx.user.findUnique({ where: { id: input.assignedToId }, select: { name: true, role: true } }) : null
    if (reassigned && input.assignedToId && current.kind === 'support' && (!assignee || assignee.role === 'FINANCE' || (handoff && assignee.role !== 'SUPPORT'))) {
      throw new AppError(400, handoff ? 'Choose a support staff member' : 'Choose an eligible ticket assignee')
    }
    const eventNotes = reassigned ? ['Assigned to ' + (assignee?.name ?? 'no one'), input.notes].filter(Boolean).join(' · ') : input.notes
    const next = await tx.schoolWork.update({
      where: { id: work.id },
      data: {
        status,
        events: changed ? { create: { status, notes: eventNotes, createdById: req.user.id } } : undefined,
        notes: input.notes, outcome: input.outcome, assignedToId: input.assignedToId,
        dueAt: input.dueAt === undefined ? undefined : input.dueAt ? new Date(input.dueAt) : null,
        ...(input.checkIn && !current.checkedInAt ? { checkedInAt: input.checkedInAt ? new Date(input.checkedInAt) : new Date(), latitude: input.latitude, longitude: input.longitude } : {}),
      },
      include: workInclude,
    })
    if (!input.followUp || next.followUpTaskId) return next
    const task = await tx.task.create({
      data: { title: input.followUp.title, type: 'REMINDER', status: 'PENDING',
        schoolId: next.schoolId, assignedToId: next.assignedToId ?? req.user.id,
        dueDate: new Date(input.followUp.dueAt), notes: next.outcome },
    })
    return tx.schoolWork.update({ where: { id: next.id }, data: { followUpTaskId: task.id }, include: workInclude })
  })
  res.json(updated)
}))

router.get('/collections', handle(async (req, res) => {
  const { schoolId, assignedToId } = parse(listSchema, req.query)
  const indiaOffset = 330 * 60_000
  const today = new Date(new Date(Date.now() + indiaOffset).toISOString().slice(0, 10))
  const midnight = new Date(today.getTime() - indiaOffset)
  const payments = await prisma.agreementPayment.findMany({
    where: { paidAt: null, dueDate: { lt: midnight }, agreement: { schoolId, school: { ...schoolScope(req.user), ...(canAssign(req.user) && assignedToId ? { assignedToId } : {}) } } },
    include: { agreement: { select: { school: { select: schoolSelect } } }, followUps: { include: workInclude, orderBy: { createdAt: 'desc' } } },
    orderBy: { dueDate: 'asc' },
  })
  res.json(apiNumbers(payments.map(({ agreement, ...p }) => ({
    ...p, school: agreement.school, daysOverdue: Math.ceil((midnight.getTime() - p.dueDate.getTime()) / 86400000),
  }))))
}))

router.post('/collections/:id/follow-ups', handle(async (req, res) => {
  const paymentId = parse(id, req.params.id)
  const { outcome, dueAt } = parse(z.object({ outcome: notes.min(1), dueAt: date.optional() }), req.body)
  const payment = await prisma.agreementPayment.findFirst({
    where: { id: paymentId, agreement: { school: schoolScope(req.user) } },
    include: { agreement: { include: { school: true } } },
  })
  if (!payment) throw new AppError(404, 'Instalment not found')
  if (payment.paidAt) throw new AppError(409, 'This instalment was already paid')
  const school = payment.agreement.school
  const result = await prisma.$transaction(async tx => {
    const current = await tx.agreementPayment.findUniqueOrThrow({ where: { id: paymentId } })
    if (current.paidAt) throw new AppError(409, 'This instalment was already paid')
    const task = dueAt ? await tx.task.create({
      data: { schoolId: school.id, assignedToId: school.assignedToId ?? req.user.id, title: 'Follow up on overdue instalment',
        dueDate: new Date(dueAt), notes: outcome, status: 'PENDING', type: 'CALL' },
    }) : null
    await tx.timelineEvent.create({ data: { schoolId: school.id, createdById: req.user.id, eventType: 'COLLECTION_FOLLOW_UP', description: 'Instalment #' + paymentId + ': ' + outcome } })
    return tx.schoolWork.create({
      data: { schoolId: school.id, paymentId, kind: 'collections', status: 'COMPLETED', title: 'Payment follow-up',
        dueAt: dueAt ? new Date(dueAt) : undefined, assignedToId: school.assignedToId, createdById: req.user.id, outcome, followUpTaskId: task?.id },
      include: workInclude,
    })
  })
  res.status(201).json(result)
}))

router.get('/files', handle(async (req, res) => {
  const { schoolId } = parse(listSchema, req.query)
  res.json(await prisma.schoolFile.findMany({
    where: { schoolId, school: schoolScope(req.user), workId: null, category: { not: 'Payment proof' } },
    select: fileSelect, orderBy: { createdAt: 'desc' },
  }))
}))

const fileSchema = schoolUpload.extend({
  schoolId: id, workId: id.optional(), category: z.enum(DOCUMENT_CATEGORIES).optional(),
})

router.post('/files', handle(async (req, res) => {
  const data = parse(fileSchema, req.body)
  const file = decodeSchoolFile(data)
  if (data.workId) {
    const ticket = await prisma.schoolWork.findFirst({ where: { id: data.workId, schoolId: data.schoolId, kind: 'support', ...workScope(req.user) } })
    if (!ticket) throw new AppError(404, 'Support ticket not found')
    if (data.mimeType === 'application/pdf') throw new AppError(400, 'Ticket attachments must be photos')
  } else await getSchool(req.user, data.schoolId)
  res.status(201).json(await prisma.schoolFile.create({
    data: { ...file, schoolId: data.schoolId, workId: data.workId,
      category: data.workId ? 'Ticket photo' : data.category ?? 'Other',
      uploadedById: req.user.id },
    select: fileSelect,
  }))
}))

router.get('/files/:id', handle(async (req, res) => {
  const scope: Prisma.SchoolFileWhereInput = canAssign(req.user) ? {} : {
    OR: req.user.role === 'SUPPORT' ? [{ work: workScope(req.user) }] : [{ school: schoolScope(req.user) }, { work: { assignedToId: req.user.id } }],
  }
  const file = await prisma.schoolFile.findFirst({ where: { id: parse(id, req.params.id), ...scope } })
  if (!file) throw new AppError(404, 'File not found')
  res.setHeader('Cache-Control', 'private, no-store')
  res.attachment(file.name).type(file.mimeType).send(Buffer.from(file.content))
}))

export default router
