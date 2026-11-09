
import { Router } from 'express'
import { z } from 'zod'
import type { WorkspaceCard, WorkspacePage } from '@lms/shared'
import { prisma } from '../../config/prisma'
import { AppError } from '../../middleware/error.middleware'
import { action, assignees, displayMoney, field, handle, id, indiaDay, indiaOffset, manager, money, onlyManager, option, parse, person, schoolScope } from './common'

const router = Router()
const periodSchema = z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/, 'Choose a month in YYYY-MM format')
const count = z.coerce.number().int().min(0).max(1e6)
const targetSchema = z.object({
  period: periodSchema, subject: z.string().regex(/^(user|territory):[1-9]\d*$/),
  visits: count, conversions: count, collections: money, renewals: count,
})
const targetFields = [
  { name: 'visits', label: 'Completed visits' }, { name: 'conversions', label: 'Lead conversions' },
  { name: 'collections', label: 'Collections (₹)' }, { name: 'renewals', label: 'Renewals won' },
] as const

router.get('/', handle(async (req, res) => {
  const period = parse(periodSchema.optional(), req.query.period) ?? indiaDay().slice(0, 7)
  const month = new Date(period + '-01')
  const start = new Date(month.getTime() - indiaOffset)
  month.setUTCMonth(month.getUTCMonth() + 1)
  const end = new Date(month.getTime() - indiaOffset)
  const range = { gte: start, lt: end }
  const isManager = manager(req.user)
  const scope = schoolScope(req.user)
  const [targets, people, territories, schools, visits, conversions, payments, renewals] = await Promise.all([
    prisma.salesTarget.findMany({
      where: { period, salespersonId: isManager ? undefined : req.user.id },
      include: { salesperson: person, territory: { select: { id: true, name: true } } },
      orderBy: { subject: 'asc' },
    }),
    isManager ? assignees() : Promise.resolve([]),
    isManager ? prisma.salesTerritory.findMany({ orderBy: { name: 'asc' } }) : Promise.resolve([]),
    prisma.school.findMany({
      where: scope,
      select: { id: true, name: true, assignedTo: person, territoryLink: { include: { territory: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.schoolWork.findMany({
      where: { kind: 'visits', status: 'COMPLETED', ...(isManager ? {} : { assignedToId: req.user.id }),
        OR: [{ events: { some: { status: 'COMPLETED', createdAt: range } } },
          { events: { none: { status: 'COMPLETED' } }, updatedAt: range }] },
      select: { schoolId: true, assignedToId: true, events: { where: { status: 'COMPLETED' }, orderBy: { createdAt: 'asc' }, take: 1, select: { createdAt: true } } },
    }),
    prisma.school.findMany({
      where: { ...scope, createdFromLeadId: { not: null }, createdAt: range }, select: { id: true, assignedToId: true },
    }),
    prisma.agreementPayment.findMany({
      where: { paidAt: range, agreement: { school: scope } },
      select: { amount: true, agreement: { select: { schoolId: true, school: { select: { assignedToId: true } } } } },
    }),
    prisma.renewalCase.findMany({
      where: { stage: 'WON', closedAt: range, ...(isManager ? {} : { ownerId: req.user.id }) },
      select: { ownerId: true, agreement: { select: { schoolId: true } } },
    }),
  ])
  const territoriesBySchool = new Map(schools.map(s => [s.id, s.territoryLink?.territoryId]))
  const progress = (salespersonId: number | null, territoryId: number | null) => {
    const belongs = (schoolId: number, userId: number | null) => territoryId != null
      ? territoriesBySchool.get(schoolId) === territoryId : userId === salespersonId
    return {
      visits: visits.filter(v => belongs(v.schoolId, v.assignedToId) && (!v.events.length || v.events[0].createdAt >= start)).length,
      conversions: conversions.filter(s => belongs(s.id, s.assignedToId)).length,
      collections: payments.filter(p => belongs(p.agreement.schoolId, p.agreement.school.assignedToId)).reduce((sum, p) => sum + Number(p.amount), 0),
      renewals: renewals.filter(r => belongs(r.agreement.schoolId, r.ownerId)).length,
    }
  }
  const options = [...people.map(p => option('user:' + p.id, p.name)), ...territories.map(t => option('territory:' + t.id, t.name + ' · Region'))]
  const targetAction = (subject?: string, values?: { visits: number; conversions: number; collections: unknown; renewals: number }) =>
    action(subject ? 'Edit target' : 'Set monthly target', '/workspace/targets', [
      field('period', 'Month (YYYY-MM)', 'text', { value: period, required: true }),
      field('subject', 'Salesperson or territory', 'select', { value: subject ?? '', options, required: true }),
      ...targetFields.map(metric => field(metric.name, metric.label, 'number', { value: String(values?.[metric.name] ?? 0), required: true })),
    ])
  const progressCards: WorkspaceCard[] = targets.map(target => {
    const current = progress(target.salespersonId, target.territoryId)
    return {
      id: 'target-' + target.id, title: target.salesperson?.name ?? target.territory?.name ?? 'Target',
      subtitle: period + (target.territoryId ? ' · Territory' : ' · Salesperson'),
      lines: targetFields.map(m => m.label + ' · ' + (m.name === 'collections'
        ? displayMoney(current.collections) + ' / ' + displayMoney(target.collections)
        : current[m.name] + ' / ' + target[m.name])),
      actions: isManager ? [targetAction(target.subject, target)] : [],
    }
  })
  if (!isManager && !targets.length) {
    const current = progress(req.user.id, null)
    progressCards.push({
      id: 'personal', title: 'My progress', subtitle: period + ' · No target set',
      lines: targetFields.map(m => m.label + ' · ' + (m.name === 'collections' ? displayMoney(current.collections) : current[m.name])),
    })
  }
  const page: WorkspacePage = {
    title: 'Sales targets & territories',
    description: 'Monthly progress for ' + period + ' uses completed visits, converted leads, received instalments and won renewals.',
    sections: [
      { title: 'Targets and progress', cards: [
        ...(isManager && options.length ? [{ id: 'set', title: 'Monthly targets', actions: [targetAction()] }] : []),
        ...progressCards,
      ] },
      { title: isManager ? 'School territories' : 'My assigned schools', cards: [
        ...(isManager ? [{ id: 'territory', title: 'Manage regions', actions: [
          action('Create territory', '/workspace/targets/territories', [field('name', 'Territory name', 'text', { required: true })]),
        ] }] : []),
        ...schools.map(school => ({
          id: 'school-' + school.id, title: school.name,
          subtitle: school.territoryLink?.territory.name ?? 'No territory assigned',
          lines: ['Salesperson · ' + (school.assignedTo?.name ?? 'Unassigned')],
          links: [{ label: 'Open school', path: '/schools/' + school.id }],
          actions: isManager && territories.length ? [action('Assign territory', '/workspace/targets/schools/' + school.id, [
            field('territoryId', 'Territory', 'select', { value: String(school.territoryLink?.territoryId ?? ''), options: [option('', 'Unassigned'), ...territories.map(t => option(t.id, t.name))] }),
          ], 'PATCH')] : [],
        })),
      ] },
    ],
  }
  res.json(page)
}))

router.post('/', handle(async (req, res) => {
  onlyManager(req.user)
  const body = parse(targetSchema, req.body)
  const [kind, rawId] = body.subject.split(':')
  const targetId = parse(id, rawId)
  const salespersonId = kind === 'user' ? targetId : null
  const territoryId = kind === 'territory' ? targetId : null
  if (salespersonId && !await prisma.user.findFirst({ where: { id: salespersonId, role: { in: ['ADMIN', 'SALES_MANAGER', 'SALES_EXECUTIVE'] } } })) {
    throw new AppError(400, 'Choose a salesperson')
  }
  if (territoryId && !await prisma.salesTerritory.findUnique({ where: { id: territoryId } })) throw new AppError(400, 'Choose a territory')
  const data = { ...body, salespersonId, territoryId }
  await prisma.salesTarget.upsert({ where: { period_subject: { period: body.period, subject: body.subject } }, create: data, update: data })
  res.json({ message: 'Monthly target saved' })
}))

router.post('/territories', handle(async (req, res) => {
  onlyManager(req.user)
  const name = parse(z.string().trim().min(1).max(120), req.body.name)
  await prisma.salesTerritory.upsert({ where: { name }, create: { name }, update: {} })
  res.status(201).json({ message: 'Territory ready' })
}))

router.patch('/schools/:id', handle(async (req, res) => {
  onlyManager(req.user)
  const schoolId = parse(id, req.params.id)
  const territoryId = parse(id.optional(), req.body.territoryId)
  if (!await prisma.school.findUnique({ where: { id: schoolId }, select: { id: true } })) throw new AppError(404, 'School not found')
  if (territoryId) {
    if (!await prisma.salesTerritory.findUnique({ where: { id: territoryId } })) throw new AppError(404, 'Territory not found')
    await prisma.territorySchool.upsert({ where: { schoolId }, create: { schoolId, territoryId }, update: { territoryId } })
  } else await prisma.territorySchool.deleteMany({ where: { schoolId } })
  res.json({ message: 'School territory updated' })
}))

export default router
