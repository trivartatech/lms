
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/prisma'
import { AppError } from '../../middleware/error.middleware'
import type { JwtPayload } from '../../middleware/auth.middleware'
import type { WorkspacePage } from '@lms/shared'
import { action, assignees, displayDate, displayMoney, field, handle, id, indiaMidnight, manager, money, note, onlyManager, option, parse, person, schoolFilter, schoolScope, timestamp } from './common'

const router = Router()
const stages = ['UPCOMING', 'CONTACTED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'] as const
const risks = ['NORMAL', 'AT_RISK'] as const
const closed = (stage: string) => stage === 'WON' || stage === 'LOST'
const label = (value: string) => value.replace(/_/g, ' ')
const access = (user: JwtPayload) => manager(user) ? {} : {
  OR: [{ school: schoolScope(user) }, { renewalCase: { ownerId: user.id } }],
}

router.get('/', handle(async (req, res) => {
  const today = indiaMidnight()
  const tomorrow = new Date(today.getTime() + 86400000)
  const horizon = new Date(today.getTime() + 90 * 86400000)
  const schoolId = schoolFilter(req)
  const [agreements, people] = await Promise.all([
    prisma.agreement.findMany({
      where: { schoolId, AND: [
        access(req.user),
        { OR: [{ renewalCase: { isNot: null } }, { status: { in: ['ACTIVE', 'PENDING_RENEWAL'] },
          OR: [{ renewalDate: { lte: horizon } }, { renewalDate: null, endDate: { lte: horizon } }] }] },
      ] },
      include: { school: { select: { id: true, name: true, assignedTo: person } }, renewalCase: { include: { owner: person } } },
      orderBy: { endDate: 'asc' },
    }),
    manager(req.user) ? assignees() : Promise.resolve([]),
  ])
  const groups: WorkspacePage['sections'] = [
    { title: 'Follow up today', cards: [] }, { title: 'Upcoming renewals', cards: [] }, { title: 'Closed renewals', cards: [] },
  ]
  for (const agreement of agreements) {
    const due = agreement.renewalDate ?? agreement.endDate
    const record = agreement.renewalCase
    const stage = record?.stage ?? 'UPCOMING'
    const risk = record?.risk === 'AT_RISK' || (!closed(stage) && due.getTime() <= today.getTime() + 14 * 86400000)
    const needsAction = record?.nextActionAt ? record.nextActionAt < tomorrow : due < tomorrow
    const owner = record ? record.owner : agreement.school.assignedTo
    const fields = [
      field('stage', 'Stage or school decision', 'select', { required: true, value: stage, options: stages.map(s => option(s, label(s))) }),
      field('risk', 'Risk', 'select', { value: record?.risk ?? 'NORMAL', options: risks.map(s => option(s, label(s))) }),
      field('proposedValue', 'Proposed value (₹)', 'number', { value: record?.proposedValue?.toString() ?? '' }),
      field('notes', 'Decision, blocker or notes', 'textarea', { value: record?.notes ?? '' }),
      field('nextActionAt', 'Next action date and time', 'datetime', { value: record?.nextActionAt?.toISOString() ?? '' }),
    ]
    if (manager(req.user)) fields.unshift(field('ownerId', 'Renewal owner', 'select', {
      value: String(owner?.id ?? ''), options: [option('', 'Unassigned'), ...people.map(p => option(p.id, p.name))],
    }))
    groups[closed(stage) ? 2 : needsAction ? 0 : 1].cards.push({
      id: String(agreement.id), title: agreement.school.name, subtitle: 'Agreement #' + agreement.id + ' · Due ' + displayDate(due),
      badge: risk && !closed(stage) ? label(stage) + ' · AT RISK' : label(stage),
      lines: [
        'Owner · ' + (owner?.name ?? 'Unassigned'),
        'Current value · ' + displayMoney(agreement.value),
        'Proposed value · ' + (record?.proposedValue != null ? displayMoney(record.proposedValue) : 'Not set'),
        'Next action · ' + displayDate(record?.nextActionAt),
        ...(record?.notes ? [record.notes] : []),
      ],
      actions: [action('Update renewal', '/workspace/renewals/' + agreement.id, fields, 'PATCH')],
      links: [{ label: 'School timeline', path: '/workspace?module=timeline&school=' + agreement.schoolId }],
    })
  }
  res.json({ title: 'Renewal desk', description: 'Review agreements due within 90 days, record decisions and schedule follow-ups.', sections: groups } satisfies WorkspacePage)
}))

const update = z.object({
  stage: z.enum(stages), risk: z.enum(risks), proposedValue: money.optional(), notes: note.optional(),
  nextActionAt: timestamp.optional(), ownerId: id.nullable().optional(),
})

router.patch('/:id', handle(async (req, res) => {
  const agreementId = parse(id, req.params.id)
  const body = parse(update, req.body)
  if (body.ownerId !== undefined) onlyManager(req.user)
  const row = await prisma.$transaction(async tx => {
    const agreement = await tx.agreement.findFirst({
      where: { id: agreementId, ...access(req.user) }, include: { school: true, renewalCase: true },
    })
    if (!agreement) throw new AppError(404, 'Agreement not found')
    const current = agreement.renewalCase
    const ownerId = body.ownerId === undefined ? (current ? current.ownerId : agreement.school.assignedToId) : body.ownerId
    if (body.ownerId && !await tx.user.findFirst({ where: { id: body.ownerId, role: { in: ['ADMIN', 'SALES_MANAGER', 'SALES_EXECUTIVE'] } } })) {
      throw new AppError(400, 'Choose a sales owner')
    }
    const nextActionAt = !closed(body.stage) && body.nextActionAt ? new Date(body.nextActionAt) : null
    let nextTaskId = current?.nextTaskId ?? null
    const task = nextTaskId ? await tx.task.findUnique({ where: { id: nextTaskId } }) : null
    if (nextActionAt) {
      if (task?.status === 'PENDING') {
        await tx.task.update({ where: { id: task.id }, data: { dueDate: nextActionAt, assignedToId: ownerId, notes: body.notes ?? null, reminderSentAt: null } })
      } else if (!task || task.dueDate.getTime() !== nextActionAt.getTime()) {
        nextTaskId = (await tx.task.create({ data: {
          title: 'Renewal follow-up · ' + agreement.school.name, schoolId: agreement.schoolId,
          type: 'REMINDER', dueDate: nextActionAt, assignedToId: ownerId, notes: body.notes,
        } })).id
      }
    } else {
      if (task?.status === 'PENDING') await tx.task.update({ where: { id: task.id }, data: { status: 'CANCELLED' } })
      nextTaskId = null
    }
    const data = {
      stage: body.stage, risk: body.risk, proposedValue: body.proposedValue ?? null,
      ownerId, notes: body.notes ?? null, nextActionAt, nextTaskId,
      closedAt: closed(body.stage) ? current?.stage === body.stage ? current.closedAt ?? new Date() : new Date() : null,
    }
    const saved = await tx.renewalCase.upsert({ where: { agreementId }, create: { agreementId, ...data }, update: data })
    await tx.timelineEvent.create({ data: {
      schoolId: agreement.schoolId, eventType: 'RENEWAL_UPDATED', createdById: req.user.id,
      description: 'Agreement #' + agreementId + ' renewal · ' + label(body.stage) + (body.notes ? ' · ' + body.notes : ''),
    } })
    return saved
  })
  res.json({ agreementId: row.agreementId })
}))

export default router
