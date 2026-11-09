
import { Router } from 'express'
import { z } from 'zod'
import type { WorkspaceCard, WorkspacePage } from '@lms/shared'
import { prisma } from '../../config/prisma'
import { AppError } from '../../middleware/error.middleware'
import { action, displayDate, displayMoney, handle, indiaMidnight, manager, parse, schoolFilter, schoolScope, timelineScope, workScope } from './common'

export const timelineRouter = Router()
timelineRouter.get('/', handle(async (req, res) => {
  const schoolId = schoolFilter(req)
  if (!schoolId) {
    res.json({ title: 'School timeline', description: 'Choose a school to view activity in one place.', sections: [] } satisfies WorkspacePage)
    return
  }
  const school = await prisma.school.findFirst({ where: { id: schoolId, ...timelineScope(req.user) }, select: { id: true, name: true, createdFromLeadId: true } })
  if (!school) throw new AppError(404, 'School not found')
  const support = req.user.role === 'SUPPORT'
  const [events, work, responses] = await Promise.all([
    support ? Promise.resolve([]) : prisma.timelineEvent.findMany({
      where: { OR: [{ schoolId }, ...(school.createdFromLeadId ? [{ leadId: school.createdFromLeadId }] : [])] },
      orderBy: { createdAt: 'desc' }, take: 100,
    }),
    prisma.schoolWorkEvent.findMany({
      where: { work: { schoolId, ...workScope(req.user), kind: support ? 'support' : { in: ['visits', 'onboarding', 'support'] } } },
      include: { work: { select: { id: true, kind: true, title: true, outcome: true } } }, orderBy: { createdAt: 'desc' }, take: 100,
    }),
    support ? Promise.resolve([]) : prisma.portalQuote.findMany({
      where: { schoolId, respondedAt: { not: null } }, select: { id: true, response: true, respondedBy: true, responseNote: true, respondedAt: true,
        version: { select: { quotationId: true, number: true } } }, orderBy: { respondedAt: 'desc' }, take: 100,
    }),
  ])
  const records: { date: Date; card: WorkspaceCard }[] = [
    ...events.map(e => ({
      date: e.createdAt, card: { id: 'event-' + e.id, title: e.eventType.replace(/_/g, ' '), lines: [e.description] },
    })),
    ...work.map(e => ({
      date: e.createdAt, card: {
        id: 'work-' + e.id, title: e.work.title, badge: e.status.replace(/_/g, ' '),
        lines: [...(e.notes ? [e.notes] : []), ...(e.status === 'COMPLETED' && e.work.outcome ? [e.work.outcome] : [])],
        links: [{ label: 'Open record', path: '/operations?module=' + e.work.kind + '&school=' + schoolId + '&record=' + e.work.id }],
      },
    })),
    ...responses.map(q => ({
      date: q.respondedAt!, card: {
        id: 'response-' + q.id, title: 'Quotation #' + q.version.quotationId + ' · V' + q.version.number,
        badge: q.response.replace(/_/g, ' '), lines: [q.respondedBy ?? 'School contact', ...(q.responseNote ? [q.responseNote] : [])],
        links: [{ label: 'Review school response', path: '/workspace?module=portal&school=' + schoolId + '&record=quote-' + q.id }],
      },
    })),
  ]
  res.json({
    title: school.name + ' timeline', description: support ? 'Updates from your assigned tickets.' : 'Visits, quotations, payments, onboarding, support and renewal activity.',
    sections: [{ title: 'Recent activity', cards: records.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 150)
      .map(({ date, card }) => ({ ...card, subtitle: date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) })) }],
  } satisfies WorkspacePage)
}))

type Notice = { key: string; title: string; detail: string; path: string; date: Date }

async function inbox(user: Express.Request['user']): Promise<Notice[]> {
  const now = new Date()
  const tomorrow = new Date(indiaMidnight(now).getTime() + 86400000)
  const financeOnly = user.role === 'FINANCE'
  const supportOnly = user.role === 'SUPPORT'
  const [quotes, payments, tasks, tickets, replies] = await Promise.all([
    manager(user) ? prisma.quotation.findMany({
      where: { approvalStatus: 'PENDING' }, select: { id: true, updatedAt: true, school: { select: { name: true } }, lead: { select: { schoolName: true } } },
      take: 100, orderBy: { updatedAt: 'desc' },
    }) : Promise.resolve([]),
    supportOnly ? Promise.resolve([]) : prisma.agreementPayment.findMany({
      where: { paidAt: null, dueDate: { lt: indiaMidnight(now) }, agreement: { school: schoolScope(user) } },
      select: { id: true, dueDate: true, amount: true, agreement: { select: { school: { select: { id: true, name: true } } } } },
      take: 100, orderBy: { dueDate: 'asc' },
    }),
    financeOnly || supportOnly ? Promise.resolve([]) : prisma.task.findMany({
      where: { assignedToId: user.id, status: 'PENDING' }, select: { id: true, title: true, dueDate: true, updatedAt: true },
      take: 100, orderBy: { dueDate: 'asc' },
    }),
    supportOnly ? prisma.schoolWork.findMany({
      where: { ...workScope(user), status: { in: ['OPEN', 'IN_PROGRESS'] } },
      select: { id: true, schoolId: true, title: true, dueAt: true, updatedAt: true }, orderBy: { dueAt: 'asc' }, take: 100,
    }) : Promise.resolve([]),
    financeOnly ? Promise.resolve([]) : prisma.supportMessage.findMany({
      where: { senderType: 'SCHOOL', work: { assignedToId: user.id, kind: 'support' } },
      select: { id: true, createdAt: true, work: { select: { id: true, title: true, schoolId: true } } },
      orderBy: { id: 'desc' }, take: 50,
    }),
  ])
  return [
    ...quotes.map(q => ({ key: 'approval:' + q.id + ':' + q.updatedAt.toISOString(), title: 'Quotation approval requested',
      detail: (q.school?.name ?? q.lead?.schoolName ?? 'Quotation') + ' · #' + q.id, path: '/quotations/' + q.id, date: q.updatedAt })),
    ...payments.map(p => ({ key: 'overdue:' + p.id + ':' + p.dueDate.toISOString(), title: 'Overdue payment',
      detail: p.agreement.school.name + ' · ' + displayMoney(p.amount) + ' · Due ' + displayDate(p.dueDate),
      path: financeOnly ? '/workspace?module=receipts&record=' + p.id : '/operations?module=collections&school=' + p.agreement.school.id + '&record=' + p.id, date: p.dueDate })),
    ...tasks.map(t => ({ key: 'task:' + t.id + ':' + t.updatedAt.toISOString(), title: t.dueDate < tomorrow ? 'Task due' : 'Assigned task',
      detail: t.title + ' · Due ' + displayDate(t.dueDate), path: '/tasks?task=' + t.id, date: t.updatedAt })),
    ...tickets.map(t => ({ key: 'ticket:' + t.id + ':' + t.updatedAt.toISOString(), title: 'Assigned support ticket',
      detail: t.title + ' · Due ' + displayDate(t.dueAt), path: '/operations?module=support&school=' + t.schoolId + '&record=' + t.id, date: t.updatedAt })),
    ...replies.map(reply => ({ key: 'ticket-reply:' + reply.id, title: 'School replied to a support ticket',
      detail: reply.work.title, path: '/operations?module=support&school=' + reply.work.schoolId + '&record=' + reply.work.id + '&chat=1', date: reply.createdAt })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime())
}

export const inboxRouter = Router()
inboxRouter.get('/', handle(async (req, res) => {
  const notices = await inbox(req.user)
  const read = new Set((await prisma.inboxRead.findMany({
    where: { userId: req.user.id, key: { in: notices.map(n => n.key) } }, select: { key: true },
  })).map(r => r.key))
  res.json({
    title: 'Notification inbox', description: 'Open the exact record behind an approval, overdue payment, assigned task or ticket.',
    sections: ['Unread', 'Read'].map(title => ({
      title, cards: notices.filter(n => read.has(n.key) === (title === 'Read')).map(n => ({
        id: n.key, title: n.title, subtitle: n.detail,
        links: [{ label: 'Open record', path: n.path }],
        actions: title === 'Unread' ? [action('Mark read', '/workspace/inbox/read/' + encodeURIComponent(n.key))] : [],
      })),
    })),
  } satisfies WorkspacePage)
}))
inboxRouter.post('/read/:key', handle(async (req, res) => {
  const key = parse(z.string().min(1).max(180), req.params.key)
  if (!(await inbox(req.user)).some(n => n.key === key)) throw new AppError(404, 'Notification no longer available')
  const data = { userId: req.user.id, key }
  await prisma.inboxRead.upsert({ where: { userId_key: data }, create: data, update: {} })
  res.json({ message: 'Marked read' })
}))
