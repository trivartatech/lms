
import { Router } from 'express'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import type { QuotationVersion, WorkspacePage } from '@lms/shared'
import { prisma } from '../../config/prisma'
import { AppError } from '../../middleware/error.middleware'
import { action, day, displayDate, field, handle, id, note, option, parse, schoolFilter, schoolName, schoolScope } from './common'

const router = Router()
const itemStates = ['PENDING', 'SCHEDULED', 'LIVE', 'BLOCKED'] as const
const eligible = { OR: [{ status: 'ACCEPTED' }, { versions: { some: { portalQuote: { response: 'ACCEPTED' } } } }] } satisfies Prisma.QuotationWhereInput
const acceptedVersion = { OR: [{ event: 'ACCEPTED' }, { portalQuote: { response: 'ACCEPTED' } }] } satisfies Prisma.QuotationVersionWhereInput

router.get('/', handle(async (req, res) => {
  const schoolId = schoolFilter(req)
  const scope = schoolScope(req.user)
  const [candidates, orders, agreements] = await Promise.all([
    prisma.quotation.findMany({
      where: { ...eligible, order: null, schoolId: schoolId ?? { not: null }, school: scope },
      select: { id: true, school: schoolName },
      orderBy: { id: 'desc' },
    }),
    prisma.schoolOrder.findMany({
      where: { schoolId, school: scope },
      include: { school: schoolName, items: { orderBy: { id: 'asc' } }, agreement: { select: { id: true, work: { where: { kind: 'onboarding' }, select: { status: true } } } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.agreement.findMany({ where: { schoolId, school: scope, status: { in: ['ACTIVE', 'PENDING_RENEWAL'] } }, select: { id: true, schoolId: true, endDate: true } }),
  ])
  const page: WorkspacePage = {
    title: 'Orders & activation', description: 'Create orders from accepted quotations and track when each purchased item goes live.',
    sections: [
      { title: 'Accepted quotations ready to order', cards: candidates.map(q => ({
        id: 'quote-' + q.id, title: q.school?.name ?? 'School', subtitle: 'Quotation #' + q.id,
        actions: [{ ...action('Create order', '/workspace/orders'), fields: [
          field('quotationId', 'Accepted quotation', 'select', { required: true, value: String(q.id), options: [option(q.id, 'Quotation #' + q.id)] }),
        ], confirm: 'Create an order using the accepted items and quantities?' }],
        links: [{ label: 'View quotation', path: '/quotations/' + q.id }],
      })) },
      { title: 'Orders', cards: orders.flatMap(order => {
        const onboarding = order.agreement?.work ?? []
        const agreementOptions = agreements.filter(a => a.schoolId === order.schoolId)
        return [{
          id: 'order-' + order.id, title: order.school.name + ' · Order #' + order.id,
          subtitle: 'Quotation #' + order.quotationId + (order.versionNumber ? ' · V' + order.versionNumber : ''),
          lines: [
            order.items.filter(i => i.status === 'LIVE').length + ' of ' + order.items.length + ' items live',
            order.agreementId ? 'Onboarding · ' + onboarding.filter(s => s.status === 'COMPLETED').length + ' of ' + onboarding.length + ' steps complete' : 'Onboarding agreement not linked',
          ],
          actions: [action('Link onboarding agreement', '/workspace/orders/' + order.id, [
            field('agreementId', 'Agreement', 'select', { value: String(order.agreementId ?? ''), options: [option('', 'No agreement'), ...agreementOptions.map(a => option(a.id, 'Agreement #' + a.id + ' · Ends ' + displayDate(a.endDate)))] }),
          ], 'PATCH')],
          links: [{ label: 'Open onboarding', path: '/operations?module=onboarding&school=' + order.schoolId }],
        }, ...order.items.map(item => ({
          id: 'item-' + item.id, title: item.name, subtitle: order.school.name + ' · Order #' + order.id,
          badge: item.status,
          lines: [
            'Purchased quantity · ' + item.quantity,
            'Seats · ' + (item.seats ?? 'Not set'),
            'Planned activation · ' + displayDate(item.activationDate),
            ...(item.activatedAt ? ['Went live · ' + displayDate(item.activatedAt)] : []),
            ...(item.blocker ? [item.blocker] : []),
          ],
          actions: [action('Update activation', '/workspace/orders/items/' + item.id, [
            field('status', 'Status', 'select', { required: true, value: item.status, options: itemStates.map(v => option(v, v)) }),
            field('seats', 'Seat count', 'number', { value: item.seats?.toString() ?? '' }),
            field('activationDate', 'Planned activation date', 'date', { value: item.activationDate?.toISOString().slice(0, 10) ?? '' }),
            field('blocker', 'Pending items or blocker', 'textarea', { value: item.blocker ?? '' }),
          ], 'PATCH')],
        }))]
      }) },
    ],
  }
  res.json(page)
}))

router.post('/', handle(async (req, res) => {
  const quotationId = parse(id, req.body.quotationId)
  const order = await prisma.$transaction(async tx => {
    const quote = await tx.quotation.findFirst({
      where: { id: quotationId, ...eligible, schoolId: { not: null }, school: schoolScope(req.user) },
      include: { items: true, versions: {
        where: acceptedVersion, include: { portalQuote: { select: { respondedAt: true, response: true } } }, orderBy: { number: 'desc' },
      } },
    })
    if (!quote || quote.schoolId == null) throw new AppError(404, 'Accepted school quotation not found')
    const previous = await tx.schoolOrder.findUnique({ where: { quotationId } })
    if (previous) return previous
    const version = quote.versions.sort((a, b) =>
      Math.max(b.portalQuote?.response === 'ACCEPTED' ? b.portalQuote.respondedAt?.getTime() ?? 0 : 0, b.event === 'ACCEPTED' ? b.createdAt.getTime() : 0)
      - Math.max(a.portalQuote?.response === 'ACCEPTED' ? a.portalQuote.respondedAt?.getTime() ?? 0 : 0, a.event === 'ACCEPTED' ? a.createdAt.getTime() : 0),
    )[0]
    const items = version ? (JSON.parse(version.snapshot) as QuotationVersion).quotation.items : quote.items
    if (!items.length) throw new AppError(409, 'The accepted quotation has no items')
    const created = await tx.schoolOrder.create({
      data: { schoolId: quote.schoolId, quotationId, versionNumber: version?.number,
        items: { create: items.map(item => ({ name: item.name, quantity: item.quantity })) } },
    })
    await tx.timelineEvent.create({ data: {
      schoolId: quote.schoolId, createdById: req.user.id, eventType: 'ORDER_CREATED',
      description: 'Order #' + created.id + ' created from quotation #' + quotationId,
    } })
    return created
  })
  res.status(201).json({ id: order.id, message: 'Order ready' })
}))

router.patch('/:id', handle(async (req, res) => {
  const orderId = parse(id, req.params.id)
  const agreementId = parse(id.optional(), req.body.agreementId)
  const order = await prisma.schoolOrder.findFirst({ where: { id: orderId, school: schoolScope(req.user) } })
  if (!order) throw new AppError(404, 'Order not found')
  if (agreementId && !await prisma.agreement.findFirst({ where: { id: agreementId, schoolId: order.schoolId } })) {
    throw new AppError(400, 'Choose an agreement for this school')
  }
  await prisma.schoolOrder.update({ where: { id: order.id }, data: { agreementId: agreementId ?? null } })
  res.json({ message: 'Onboarding link saved' })
}))

router.patch('/items/:id', handle(async (req, res) => {
  const itemId = parse(id, req.params.id)
  const body = parse(z.object({
    status: z.enum(itemStates), seats: z.coerce.number().int().min(0).max(1e6).optional(),
    activationDate: day.optional(), blocker: note.optional(),
  }), req.body)
  if (body.status === 'BLOCKED' && !body.blocker) throw new AppError(400, 'Describe what is blocking activation')
  if (body.status === 'SCHEDULED' && !body.activationDate) throw new AppError(400, 'Choose the planned activation date')
  await prisma.$transaction(async tx => {
    const item = await tx.schoolOrderItem.findFirst({ where: { id: itemId, order: { school: schoolScope(req.user) } }, include: { order: true } })
    if (!item) throw new AppError(404, 'Order item not found')
    await tx.schoolOrderItem.update({ where: { id: item.id }, data: {
      status: body.status, seats: body.seats ?? null, activationDate: body.activationDate ? new Date(body.activationDate) : null,
      activatedAt: body.status === 'LIVE' ? item.activatedAt ?? new Date() : null, blocker: body.blocker ?? null,
    } })
    await tx.timelineEvent.create({ data: {
      schoolId: item.order.schoolId, createdById: req.user.id, eventType: 'ORDER_ACTIVATION',
      description: item.name + ' · ' + body.status + (body.blocker ? ' · ' + body.blocker : ''),
    } })
  })
  res.json({ message: 'Activation updated' })
}))

export default router
