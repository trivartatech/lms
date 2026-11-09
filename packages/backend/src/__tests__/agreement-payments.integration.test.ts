import { pushService } from '../services/push.service'
import { randomUUID } from 'node:crypto'
import type { SupportMessage, SupportMessagePage, WorkspacePage, LeadDuplicateCheck, OverdueInstalment, Quotation, QuotationVersion, QuotationWorkflow, SchoolFile, SchoolWork } from '@lms/shared'
import express from 'express'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import jwt from 'jsonwebtoken'
import { env } from '../config/env'
import operationsRoutes from '../routes/operations.routes'
import quotationsRoutes from '../routes/quotations.routes'
import routes from '../routes'
import leadsRoutes from '../routes/leads.routes'
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'
import path from 'node:path'
vi.mock('../config/prisma', async () => {
  const { PrismaClient } = await import('@prisma/client')
  const path = await import('node:path')
  const { randomUUID } = await import('node:crypto')
  const testDbPath = path.resolve('prisma', `lms-payments-${randomUUID()}.db`)
  const { writeFileSync } = await import('node:fs')
  writeFileSync(testDbPath, '')
  return { testDbPath, prisma: new PrismaClient({ datasources: { db: { url: `file:${testDbPath.replace(/\\/g, '/')}` } } }) }
})
import * as config from '../config/prisma'
import { agreementPaymentsService as payments } from '../services/agreement-payments.service'
import { agreementsService } from '../services/agreements.service'
import { runAgreementRenewals, renewalMilestone } from '../jobs/agreementRenewals'
import { matchesSupportQueue, localDateInput, rescheduleTaskDate, matchesTaskView } from '@lms/shared'
const { prisma } = config
let agreementId: number
let userId: number
const dbPath = (config as any).testDbPath as string
beforeAll(() => {
  execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy', '--schema', path.resolve('prisma/schema.prisma')], { env: { ...process.env, DATABASE_URL: `file:${dbPath.replace(/\\/g, '/')}` }, stdio: 'pipe' })
}, 30000)
afterAll(async () => { await prisma.$disconnect(); for (const suffix of ['', '-journal', '-wal', '-shm']) rmSync(dbPath + suffix, { force: true }) })
beforeEach(async () => {
  await prisma.schoolOrder.deleteMany()
  await prisma.portalQuote.deleteMany()
  await prisma.salesTerritory.deleteMany()
  await prisma.agreement.deleteMany()
  await prisma.bankEntry.deleteMany()
  await prisma.task.deleteMany()
  await prisma.timelineEvent.deleteMany()
  await prisma.school.deleteMany()
  await prisma.user.deleteMany()
  const user = await prisma.user.create({ data: { name: 'Test', email: 'test@example.test', passwordHash: 'test', role: 'ADMIN' } })
  userId = user.id
  const school = await prisma.school.create({ data: { name: 'Test school', phone: '123', contactPerson: 'Test', assignedToId: userId } })
  const a = await prisma.agreement.create({ data: { schoolId: school.id, startDate: new Date('2026-01-01'), endDate: new Date('2026-11-26'), value: 100, advancePayment: 10 } })
  agreementId = a.id
})
describe('agreement payment ledger in SQLite', () => {
  it('keeps advance separate and updates the balance when an instalment is received', async () => {
    const p = await payments.add(agreementId, { amount: 40, dueDate: '2026-11-07' }, userId)
    expect(Number((await payments.get(agreementId)).outstanding)).toBe(90)
    await payments.receive(agreementId, p.id, userId)
    const summary = await payments.get(agreementId)
    expect(Number(summary.received)).toBe(50)
    expect(Number(summary.outstanding)).toBe(50)
    expect(Number(summary.unscheduled)).toBe(50)
    await payments.receive(agreementId, p.id, userId)
    expect(await prisma.timelineEvent.count({ where: { eventType: 'AGREEMENT_PAYMENT_RECEIVED' } })).toBe(1)
  })
  it('rejects allocation beyond the agreement balance and disallows removing received money', async () => {
    await expect(payments.add(agreementId, { amount: 91, dueDate: '2026-11-07' }, userId)).rejects.toMatchObject({ statusCode: 400 })
    const p = await payments.add(agreementId, { amount: 40, dueDate: '2026-11-07', paidAt: '2026-01-01' }, userId)
    await expect(payments.remove(agreementId, p.id)).rejects.toMatchObject({ statusCode: 400 })
    await expect(agreementsService.update(agreementId, { value: 20 }, userId)).rejects.toMatchObject({ statusCode: 400 })
  })
  it('releases allocation when an unpaid schedule is removed', async () => {
    const p = await payments.add(agreementId, { amount: 40, dueDate: '2026-11-07' }, userId)
    await payments.remove(agreementId, p.id)
    expect(Number((await payments.get(agreementId)).unscheduled)).toBe(90)
  })
  it('does not over-allocate concurrent requests', async () => {
    const results = await Promise.allSettled([payments.add(agreementId, { amount: 80, dueDate: '2026-11-07' }, userId), payments.add(agreementId, { amount: 80, dueDate: '2026-11-07' }, userId)])
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect(Number((await payments.get(agreementId)).unscheduled)).toBe(10)
  })
})
describe('renewal tasks', () => {
  it('creates one task per milestone and survives repeated sweeps', async () => {
    await runAgreementRenewals(new Date('2026-11-06T00:00:00Z'))
    await runAgreementRenewals(new Date('2026-11-06T00:00:00Z'))
    expect(await prisma.agreementRenewalReminder.count()).toBe(1)
    await runAgreementRenewals(new Date('2026-11-16T00:00:00Z'))
    await runAgreementRenewals(new Date('2026-11-22T00:00:00Z'))
    expect(await prisma.agreementRenewalReminder.count()).toBe(3)
    expect(await prisma.task.count({ where: { assignedToId: userId } })).toBe(3)
  })
  it('cancels obsolete renewal tasks when the agreement is extended', async () => {
    await runAgreementRenewals(new Date('2026-11-06T00:00:00Z'))
    await agreementsService.update(agreementId, { endDate: '2027-11-26' }, userId)
    expect(await prisma.task.count({ where: { status: 'PENDING' } })).toBe(0)
    expect(await prisma.task.count({ where: { status: 'CANCELLED' } })).toBe(1)
  })
  it('skips dates beyond the window and already expired agreements', () => {
    expect(renewalMilestone(new Date('2027-01-01'), new Date('2026-11-06'))).toBeNull()
    expect(renewalMilestone(new Date('2026-11-01'), new Date('2026-11-06'))).toBeNull()
  })
})
describe('task scheduling', () => {
  it('preserves local hours when the day changes', () => {
    const original = new Date(2026, 10, 6, 18, 30).toISOString()
    const moved = new Date(rescheduleTaskDate(original, '2026-11-09'))
    expect(moved.getHours()).toBe(18)
    expect(moved.getMinutes()).toBe(30)
    expect(localDateInput(moved)).toBe('2026-11-09')
  })
  it('filters pending tasks by the local calendar day', () => {
    const now = new Date(2026, 10, 6, 12)
    expect(matchesTaskView({ status: 'PENDING', dueDate: new Date(2026, 10, 6, 18).toISOString() }, 'TODAY', now)).toBe(true)
    expect(matchesTaskView({ status: 'COMPLETED', dueDate: '2026-11-01' }, 'OVERDUE', now)).toBe(false)
    expect(matchesTaskView({ status: 'PENDING', dueDate: '2026-11-07' }, 'UPCOMING', now)).toBe(true)
  })
})

describe('school operations and quotation workflows over HTTP', () => {
  let server: Server
  let base: string
  let schoolId: number
  beforeAll(async () => {
    const app = express()
    app.use(express.json({ limit: '7mb' }))
    app.use('/api', routes)
    app.use('/operations', operationsRoutes)
    app.use('/quotations', quotationsRoutes)
    app.use('/leads', leadsRoutes)
    app.use((err: { statusCode?: number; message: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(err.statusCode ?? 500).json({ message: err.message })
    })
    server = await new Promise<Server>((resolve, reject) => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener))
      listener.once('error', reject)
    })
    base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port
  })
  afterAll(async () => {
    if (!server) return
    server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
  })
  beforeEach(async () => { schoolId = (await prisma.agreement.findUniqueOrThrow({ where: { id: agreementId } })).schoolId })

  function send<T = unknown>(path: string, method = 'GET', body?: object, actor = { id: userId, role: 'ADMIN' }) {
    return bearer<T>(path, jwt.sign(actor, env.JWT_ACCESS_SECRET), method, body)
  }

  async function bearer<T = unknown>(path: string, token: string, method = 'GET', body?: object) {
    const response = await fetch(base + path, {
      method, headers: { authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const data = response.headers.get('content-type')?.includes('application/json')
      ? await response.json() : Buffer.from(await response.arrayBuffer())
    return { status: response.status, data: data as T }
  }

  it('starts a checklist only once for a signed agreement', async () => {
    const first = await send<SchoolWork[]>('/operations/onboarding', 'POST', { schoolId, agreementId })
    expect(first.status).toBe(200)
    expect(first.data).toHaveLength(4)
    await send('/operations/work/' + first.data[0].id, 'PATCH', { status: 'BLOCKED', notes: 'Waiting for student data' })
    const repeat = await send<SchoolWork[]>('/operations/onboarding', 'POST', { schoolId, agreementId })
    expect(repeat.data.map((v: { id: number }) => v.id)).toEqual(first.data.map((v: { id: number }) => v.id))
    expect(repeat.data[0]).toMatchObject({ status: 'BLOCKED', notes: 'Waiting for student data' })
  })

  it('preserves offline check-in time and creates one follow-up on repeated saves', async () => {
    const visit = await send<SchoolWork>('/operations/work/visits', 'POST', { schoolId, title: 'School visit', dueAt: '2026-11-07T10:00:00.000Z' })
    expect(visit.status).toBe(201)
    const path = '/operations/work/' + visit.data.id
    const checkIn = await send(path, 'PATCH', { checkIn: true, checkedInAt: '2026-11-07T10:05:00.000Z', latitude: 13, longitude: 77 })
    expect(checkIn.data).toMatchObject({ status: 'CHECKED_IN', checkedInAt: '2026-11-07T10:05:00.000Z', latitude: 13 })
    const update = { status: 'COMPLETED', outcome: 'Demo requested', followUp: { title: 'Arrange a demo', dueAt: '2026-11-10T10:00:00.000Z' } }
    expect((await send(path, 'PATCH', { ...update, expectedUpdatedAt: '2025-01-01T00:00:00.000Z' })).status).toBe(409)
    const completed = await send<SchoolWork>(path, 'PATCH', update)
    expect(completed.status).toBe(200)
    expect(completed.data.followUpTaskId).toBeTruthy()
    const retry = await send<SchoolWork>(path, 'PATCH', update)
    expect(retry.data.followUpTaskId).toBe(completed.data.followUpTaskId)
    expect(await prisma.task.count({ where: { schoolId } })).toBe(1)
  })

  it('keeps school documents private and records ticket updates and photos', async () => {
    const ticket = await send<SchoolWork>('/operations/work/support', 'POST', { schoolId, title: 'Login issue', dueAt: '2026-11-10T10:00:00.000Z' })
    expect(ticket.status).toBe(201)
    const body = { schoolId, workId: ticket.data.id, name: 'login.png', mimeType: 'image/png', base64: 'iVBORw0KGgo=' }
    const photo = await send<SchoolFile>('/operations/files', 'POST', body)
    expect(photo.status).toBe(201)
    const resolved = await send<SchoolWork>('/operations/work/' + ticket.data.id, 'PATCH', { status: 'RESOLVED', notes: 'Fixed account access' })
    expect(resolved.data.files).toHaveLength(1)
    expect(resolved.data.events).toEqual(expect.arrayContaining([expect.objectContaining({ status: 'OPEN' }), expect.objectContaining({ status: 'RESOLVED' })]))
    expect((await send('/operations/files/' + photo.data.id)).data).toEqual(Buffer.from(body.base64, 'base64'))
    const unrelated = await prisma.user.create({ data: { name: 'Other', email: 'other@example.test', passwordHash: 'test', role: 'SALES_EXECUTIVE' } })
    expect((await send('/operations/files/' + photo.data.id, 'GET', undefined, unrelated)).status).toBe(404)
    const wrongMime = await send('/operations/files', 'POST', { ...body, mimeType: 'image/jpeg' })
    expect(wrongMime.status).toBe(400)
  })

  it('shows overdue unpaid instalments and preserves collection follow-up history', async () => {
    const overdue = await payments.add(agreementId, { amount: 20, dueDate: '2025-11-01' }, userId)
    const settled = await payments.add(agreementId, { amount: 20, dueDate: '2025-11-02', paidAt: '2026-01-01' }, userId)
    const logged = await send('/operations/collections/' + overdue.id + '/follow-ups', 'POST', { outcome: 'School will pay next week' })
    expect(logged.status).toBe(201)
    const list = await send<OverdueInstalment[]>('/operations/collections')
    expect(list.data.map((v: { id: number }) => v.id)).toEqual([overdue.id])
    expect(list.data[0].followUps[0].outcome).toBe('School will pay next week')
    expect((await send('/operations/collections/' + settled.id + '/follow-ups', 'POST', { outcome: 'Paid' })).status).toBe(409)
  })

  it('requires manager approval and preserves the sent revision when pricing changes', async () => {
    const created = await send<Quotation>('/quotations', 'POST', { schoolId, discount: 20, items: [{ name: 'Package', quantity: 1, type: 'ERP', unitPrice: 100 }] })
    const qid = created.data.id
    expect(created.status).toBe(201)
    const path = '/quotations/' + qid
    expect((await send(path, 'PUT', { status: 'SENT' })).status).toBe(409)
    expect((await send<{ approvalStatus: string }>(path + '/approval', 'POST')).data.approvalStatus).toBe('PENDING')
    const review = await send<Quotation>(path)
    const decision = { approved: true, reviewedAt: review.data.updatedAt }
    expect((await send(path + '/approval', 'PATCH', decision, { id: userId, role: 'SALES_EXECUTIVE' })).status).toBe(403)
    expect((await send<{ approvalStatus: string }>(path + '/approval', 'PATCH', decision)).data.approvalStatus).toBe('APPROVED')
    expect((await send(path, 'PUT', { status: 'SENT' })).status).toBe(200)
    const revised = await send<Quotation>(path, 'PUT', { discount: 30 })
    expect(revised.data).toMatchObject({ discount: 30, status: 'DRAFT', approvalStatus: 'NONE' })
    expect((await send(path + '/shared', 'POST', { updatedAt: revised.data.updatedAt })).status).toBe(409)
    const workflow = await send<QuotationWorkflow>(path + '/workflow')
    const sent = workflow.data.versions.find((v: { event: string }) => v.event === 'SENT')
    const saved = await send<QuotationVersion>(path + '/versions/' + sent!.id)
    expect(saved.data.quotation).toMatchObject({ discount: 20, total: 80, status: 'SENT' })
    expect((await send(path, 'DELETE')).status).toBe(409)
    const copy = await send<Quotation>(path + '/duplicate', 'POST')
    expect(copy.status).toBe(201)
    expect(copy.data).toMatchObject({ discount: 30, status: 'DRAFT', approvalStatus: 'NONE' })
    expect(copy.data.id).not.toBe(qid)
  })

  it('keeps previously issued quotations exportable and preserves them after editing', async () => {
    const legacy = await prisma.quotation.create({
      data: { schoolId, subtotal: 100, discount: 40, tax: 0, total: 60, status: 'SENT',
        items: { create: { name: 'Package', quantity: 1, type: 'ERP', unitPrice: 100, total: 100 } } },
    })
    const path = '/quotations/' + legacy.id
    expect((await send(path + '/shared', 'POST', { updatedAt: legacy.updatedAt.toISOString() })).status).toBe(200)
    expect((await send(path, 'PUT', { discount: 45 })).status).toBe(200)
    expect((await send(path, 'DELETE')).status).toBe(409)
  })

  it('finds normalized lead and school matches without exposing other owners’ records', async () => {
    await prisma.school.update({ where: { id: schoolId }, data: { name: 'Test School', phone: '9876543210', location: 'Bengaluru' } })
    const payload = { schoolName: ' test-school ', phone: '+91 98765 43210', location: ' bengaluru ' }
    const match = await send<LeadDuplicateCheck>('/leads/duplicates/check', 'POST', payload)
    expect(match.data.matches[0]).toMatchObject({ name: 'Test School', reasons: ['School name', 'Phone', 'Location'] })
    const unrelated = await prisma.user.create({ data: { name: 'Other', email: 'other@example.test', passwordHash: 'test', role: 'SALES_EXECUTIVE' } })
    const restricted = await send<LeadDuplicateCheck>('/leads/duplicates/check', 'POST', payload, unrelated)
    expect(restricted.status).toBe(200)
    expect(restricted.data.matches[0]).toMatchObject({ id: null, name: null, location: null })
    const newLead = { schoolName: 'New school', phone: '9876501234', location: 'Delhi' }
    const batch = await send<LeadDuplicateCheck>('/leads/duplicates/check', 'POST', [payload, newLead, newLead])
    expect(batch.data.total).toBe(2)
    expect(batch.data.matches[1].reasons).toContain('Repeated in file')
  })

  async function staff(role: string, email = role.toLowerCase() + '@example.test') {
    return prisma.user.create({ data: { name: role, email, passwordHash: 'test', role } })
  }

  it('isolates school portal access and creates one order from the accepted version', async () => {
    const otherSchool = await prisma.school.create({ data: { name: 'Other school', phone: '456', contactPerson: 'Other' } })
    const contact = await prisma.contact.create({ data: { name: 'School contact', phone: '123', schoolId } })
    const otherContact = await prisma.contact.create({ data: { name: 'Other contact', phone: '456', schoolId: otherSchool.id } })
    const codePath = '/api/workspace/portal/access/'
    const code = await send<{ secret: string }>(codePath + contact.id, 'POST', { days: 7 })
    const other = await send<{ secret: string }>(codePath + otherContact.id, 'POST', { days: 7 })
    expect(code.status).toBe(200)
    expect((await prisma.schoolPortalAccess.findUniqueOrThrow({ where: { contactId: contact.id } })).tokenHash).not.toBe(code.data.secret)
    const quote = await send<Quotation>('/api/quotations', 'POST', { schoolId, items: [{ name: 'Original package', quantity: 2, type: 'ERP', unitPrice: 100 }] })
    const path = '/api/quotations/' + quote.data.id
    expect((await send(path, 'PUT', { status: 'SENT' })).status).toBe(200)
    const version = await prisma.quotationVersion.findFirstOrThrow({ where: { quotationId: quote.data.id, event: 'SENT' } })
    const publish = '/api/workspace/portal/publish-quote/'
    expect((await send(publish + otherSchool.id, 'POST', { versionId: version.id })).status).toBe(404)
    expect((await send(publish + schoolId, 'POST', { versionId: version.id })).status).toBe(200)
    expect((await send(path, 'PUT', { items: [{ name: 'New package', quantity: 5, type: 'ERP', unitPrice: 100 }] })).status).toBe(200)
    const portalQuote = await prisma.portalQuote.findUniqueOrThrow({ where: { versionId: version.id } })
    const portal = '/api/portal'
    const file = { name: 'school.pdf', mimeType: 'application/pdf', base64: Buffer.from('%PDF-1.4\nfixture').toString('base64') }
    const uploaded = await bearer<{ id: number }>(portal + '/documents', code.data.secret, 'POST', { file })
    expect(uploaded.status).toBe(201)
    const document = portal + '/documents/' + uploaded.data.id
    expect((await bearer(document, code.data.secret)).status).toBe(200)
    expect((await bearer(document, other.data.secret)).status).toBe(404)
    expect((await bearer<WorkspacePage>(portal, code.data.secret)).data.sections[0].cards[0].lines?.[0]).toContain('Original package')
    expect((await bearer<WorkspacePage>(portal, other.data.secret)).data.sections[0].cards).toHaveLength(0)
    const responsePath = portal + '/quotes/' + portalQuote.id + '/accept'
    expect((await bearer(responsePath, other.data.secret, 'POST')).status).toBe(409)
    const replies = await Promise.all([bearer(responsePath, code.data.secret, 'POST'), bearer(responsePath, code.data.secret, 'POST')])
    expect(replies.map(r => r.status).sort()).toEqual([200, 409])
    const newOrder = await send<{ id: number }>('/api/workspace/orders', 'POST', { quotationId: quote.data.id })
    const repeat = await send<{ id: number }>('/api/workspace/orders', 'POST', { quotationId: quote.data.id })
    expect(newOrder.status).toBe(201)
    expect(repeat.data.id).toBe(newOrder.data.id)
    const order = await prisma.schoolOrder.findUniqueOrThrow({ where: { id: newOrder.data.id }, include: { items: true } })
    expect(order.versionNumber).toBe(version.number)
    expect(order.items[0]).toMatchObject({ name: 'Original package', quantity: 2 })
    expect((await send('/api/workspace/orders/' + order.id, 'PATCH', { agreementId })).status).toBe(200)
    expect((await send('/api/workspace/orders/items/' + order.items[0].id, 'PATCH', { status: 'LIVE', seats: 25 })).status).toBe(200)
    expect((await prisma.schoolOrderItem.findUniqueOrThrow({ where: { id: order.items[0].id } })).activatedAt).toBeInstanceOf(Date)
    await send(codePath + contact.id, 'DELETE')
    expect((await bearer(portal, code.data.secret)).status).toBe(401)
  })

  it('matches each bank credit once and issues a repeatable receipt PDF', async () => {
    const finance = await staff('FINANCE')
    const sales = await staff('SALES_EXECUTIVE')
    await prisma.school.update({ where: { id: schoolId }, data: { name: 'École Test', assignedToId: sales.id } })
    const payment = await payments.add(agreementId, { amount: 25, dueDate: '2026-01-01', paidAt: '2026-01-02' }, userId)
    const second = await payments.add(agreementId, { amount: 25, dueDate: '2026-01-01', paidAt: '2026-01-02' }, userId)
    const base = '/api/workspace/receipts/'
    const path = base + payment.id
    expect((await send(path + '/proof', 'PATCH', { reference: 'credit-1' }, sales)).status).toBe(200)
    expect((await send(path + '/issue', 'POST', {}, finance)).status).toBe(409)
    expect((await send(base + 'bank', 'POST', { amount: 25, reference: 'credit-1', receivedAt: '2026-01-02' }, sales)).status).toBe(403)
    expect((await send(base + 'bank', 'POST', { amount: 25, reference: 'credit-1', receivedAt: '2026-01-02' }, finance)).status).toBe(201)
    const entry = await prisma.bankEntry.findUniqueOrThrow({ where: { reference: 'CREDIT-1' } })
    const different = await prisma.bankEntry.create({ data: { reference: 'CREDIT-2', receivedAt: new Date('2026-01-02'), amount: 26 } })
    expect((await send(path + '/match', 'POST', { bankEntryId: different.id }, finance)).status).toBe(400)
    expect((await send(path + '/match', 'POST', { bankEntryId: entry.id }, finance)).status).toBe(200)
    expect((await send(base + second.id + '/match', 'POST', { bankEntryId: entry.id }, finance)).status).toBe(409)
    expect((await send(path + '/issue', 'POST', {}, finance)).status).toBe(200)
    expect((await send(path + '/issue', 'POST', {}, finance)).status).toBe(200)
    const receipt = await send<Buffer>(path + '/receipt', 'GET', undefined, sales)
    expect(receipt.status, Buffer.isBuffer(receipt.data) ? undefined : JSON.stringify(receipt.data)).toBe(200)
    expect(receipt.data.subarray(0, 4).toString()).toBe('%PDF')
    expect(await prisma.timelineEvent.count({ where: { eventType: 'RECEIPT_ISSUED' } })).toBe(1)
  })

  it('updates one renewal task and shows its exact link and won target progress', async () => {
    const sales = await staff('SALES_EXECUTIVE')
    await prisma.school.update({ where: { id: schoolId }, data: { assignedToId: sales.id } })
    const path = '/api/workspace/renewals/' + agreementId
    const updates = { stage: 'CONTACTED', risk: 'AT_RISK', ownerId: sales.id, proposedValue: '150', nextActionAt: '2026-11-20T05:30:00Z' }
    expect((await send(path, 'PATCH', updates)).status).toBe(200)
    const before = await prisma.renewalCase.findUniqueOrThrow({ where: { agreementId } })
    expect((await send(path, 'PATCH', { ...updates, nextActionAt: '2026-11-21T05:30:00Z' })).status).toBe(200)
    expect(await prisma.task.count({ where: { schoolId } })).toBe(1)
    const inbox = await send<WorkspacePage>('/api/workspace/inbox', 'GET', undefined, sales)
    const taskNotice = inbox.data.sections[0].cards.find(card => card.id.startsWith('task:'))
    expect(taskNotice?.links?.[0].path).toBe('/tasks?task=' + before.nextTaskId)
    expect((await send('/api' + taskNotice!.actions![0].path, 'POST', {}, sales)).status).toBe(200)
    expect((await send<WorkspacePage>('/api/workspace/inbox', 'GET', undefined, sales)).data.sections[1].cards).toHaveLength(1)
    expect((await send(path, 'PATCH', { stage: 'WON', risk: 'NORMAL' }, sales)).status).toBe(200)
    const renewal = await prisma.renewalCase.findUniqueOrThrow({ where: { agreementId } })
    const period = new Date(renewal.closedAt!.getTime() + 330 * 60_000).toISOString().slice(0, 7)
    const target = '/api/workspace/targets'
    expect((await send(target, 'POST', { period, subject: 'user:' + sales.id, visits: 2, conversions: 1, collections: 100, renewals: 1 })).status).toBe(200)
    const progress = await send<WorkspacePage>(target + '?period=' + period, 'GET', undefined, sales)
    expect(progress.data.sections[0].cards[0].lines).toContain('Renewals won · 1 / 1')
    const timeline = await send<WorkspacePage>('/api/workspace/timeline?schoolId=' + schoolId, 'GET', undefined, sales)
    expect(timeline.data.sections[0].cards.map(card => card.title)).toContain('RENEWAL UPDATED')
  })

  it('serves scoped staff views even with an old role in the token', async () => {
    const [support, otherSupport, finance, sales] = await Promise.all([
      staff('SUPPORT'), staff('SUPPORT', 'other-support@example.test'), staff('FINANCE'), staff('SALES_EXECUTIVE'),
    ])
    const work = '/api/operations/work/'
    const ticket = await send<SchoolWork>(work + 'support', 'POST', { title: 'Assigned ticket', schoolId, assignedToId: support.id, dueAt: '2026-11-19T05:30:00Z' })
    expect(ticket.status).toBe(201)
    expect((await send<SchoolWork[]>(work + 'support', 'GET', undefined, support)).data.map(t => t.id)).toEqual([ticket.data.id])
    expect((await send<SchoolWork[]>(work + 'support', 'GET', undefined, otherSupport)).data).toEqual([])
    expect((await send(work + ticket.data.id, 'PATCH', { status: 'RESOLVED' }, otherSupport)).status).toBe(404)
    const notice = await send<WorkspacePage>('/api/workspace/inbox', 'GET', undefined, support)
    expect(notice.data.sections[0].cards[0].links?.[0].path).toBe('/operations?module=support&school=' + schoolId + '&record=' + ticket.data.id)
    expect((await send('/api/operations/collections', 'GET', undefined, finance)).status).toBe(200)
    expect((await send(work + 'support', 'GET', undefined, { ...finance, role: 'ADMIN' })).status).toBe(403)
    expect((await send('/api/workspace/receipts', 'GET', undefined, support)).status).toBe(403)
    expect((await send('/api/schools/' + schoolId, 'GET', undefined, sales)).status).toBe(404)
    expect((await send('/api/agreements', 'GET', undefined, sales)).data).toEqual([])
    expect((await send<{ totalSchools: number }>('/api/dashboard/stats', 'GET', undefined, sales)).data.totalSchools).toBe(0)
  })

  it('keeps ticket chat scoped to its school and assigned staff, with one message per request', async () => {
    const [assigned, unrelated] = await Promise.all([
      staff('SUPPORT'), staff('SUPPORT', 'other-chat-support@example.test'),
    ])
    const school = await prisma.school.create({ data: { name: 'Other school', phone: '456', contactPerson: 'Other' } })
    const contact = await prisma.contact.create({ data: { name: 'School contact', phone: '123', schoolId } })
    const outsider = await prisma.contact.create({ data: { name: 'Other contact', phone: '456', schoolId: school.id } })
    const codePath = '/api/workspace/portal/access/'
    const mine = await send<{ secret: string }>(codePath + contact.id, 'POST', { days: 7 })
    const theirs = await send<{ secret: string }>(codePath + outsider.id, 'POST', { days: 7 })
    const ticket = await send<SchoolWork>('/api/operations/work/support', 'POST', {
      schoolId, title: 'Login issue', notes: 'Internal investigation', assignedToId: assigned.id, dueAt: '2026-11-19T05:30:00Z',
    })
    expect(ticket.status).toBe(201)
    const staffPath = '/api/operations/work/' + ticket.data.id + '/messages'
    const portalPath = '/api/portal/tickets/' + ticket.data.id + '/messages'
    expect((await send(staffPath, 'GET', undefined, unrelated)).status).toBe(404)
    expect((await bearer(portalPath, theirs.data.secret)).status).toBe(404)

    const portal = await bearer<WorkspacePage>('/api/portal', mine.data.secret)
    expect(portal.data.sections.find(section => section.title === 'Support tickets')?.cards.find(card => card.id === 'ticket-' + ticket.data.id)?.ticketChatPath).toBe(portalPath.slice(4))
    const body = { text: 'The login page shows an error.', requestId: randomUUID() }
    expect((await bearer(portalPath, theirs.data.secret, 'POST', body)).status).toBe(404)
    expect((await bearer(portalPath, mine.data.secret, 'POST', { ...body, text: '   ' })).status).toBe(400)
    const attempts = await Promise.all([
      bearer<SupportMessage>(portalPath, mine.data.secret, 'POST', body),
      bearer<SupportMessage>(portalPath, mine.data.secret, 'POST', body),
    ])
    expect(attempts.every(attempt => attempt.status === 200 || attempt.status === 409)).toBe(true)
    const first = attempts.find(attempt => attempt.status === 200)!
    expect(first).toBeDefined()
    expect(attempts.filter(attempt => attempt.status === 200).every(attempt => attempt.data.id === first.data.id)).toBe(true)
    const retry = await bearer<SupportMessage>(portalPath, mine.data.secret, 'POST', body)
    expect(retry.status).toBe(200)
    expect(retry.data.id).toBe(first.data.id)
    expect((await bearer(portalPath, mine.data.secret, 'POST', { ...body, text: 'Different message' })).status).toBe(409)
    expect(await prisma.supportMessage.count({ where: { workId: ticket.data.id } })).toBe(1)
    const inbox = await send<WorkspacePage>('/api/workspace/inbox', 'GET', undefined, assigned)
    const reply = inbox.data.sections[0].cards.find(card => card.id === 'ticket-reply:' + first.data.id)
    expect(reply?.links?.[0].path).toBe('/operations?module=support&school=' + schoolId + '&record=' + ticket.data.id + '&chat=1')
    expect((await send<WorkspacePage>('/api/workspace/inbox', 'GET', undefined, unrelated)).data.sections[0].cards).toHaveLength(0)

    const fromStaff = { text: 'We are looking into it.', requestId: randomUUID() }
    expect((await send(staffPath, 'POST', fromStaff, unrelated)).status).toBe(404)
    expect((await send(staffPath, 'POST', fromStaff, assigned)).status).toBe(200)
    const schoolThread = await bearer<SupportMessagePage>(portalPath, mine.data.secret)
    const staffThread = await send<SupportMessagePage>(staffPath, 'GET', undefined, assigned)
    expect(schoolThread.data.messages).toMatchObject([
      { senderType: 'STAFF', text: fromStaff.text, mine: false },
      { senderType: 'SCHOOL', text: body.text, mine: true },
    ])
    expect(staffThread.data.messages.map(message => message.mine)).toEqual([true, false])
    expect(JSON.stringify(schoolThread.data)).not.toContain('Internal investigation')
    expect((await prisma.schoolWork.findUniqueOrThrow({ where: { id: ticket.data.id } })).notes).toBe('Internal investigation')

    await prisma.supportMessage.createMany({ data: Array.from({ length: 30 }, (_, i) => ({
      workId: ticket.data.id, senderType: 'STAFF', senderId: assigned.id, senderName: assigned.name,
      requestId: randomUUID(), text: 'Message ' + i,
    })) })
    const newest = await bearer<SupportMessagePage>(portalPath, mine.data.secret)
    expect(newest.data.messages).toHaveLength(30)
    const older = await bearer<SupportMessagePage>(portalPath + '?before=' + newest.data.nextBefore, mine.data.secret)
    expect(older.data.messages.map(message => message.text)).toEqual([fromStaff.text, body.text])
    expect(older.data.nextBefore).toBeNull()
    expect((await send('/api/operations/work/' + ticket.data.id, 'PATCH', { assignedToId: unrelated.id })).status).toBe(200)
    expect((await send(staffPath, 'GET', undefined, assigned)).status).toBe(404)
    expect((await send(staffPath, 'POST', fromStaff, assigned)).status).toBe(404)
    expect((await send<SupportMessagePage>(staffPath, 'GET', undefined, unrelated)).data.messages).toHaveLength(30)
    const oldInbox = await send<WorkspacePage>('/api/workspace/inbox', 'GET', undefined, assigned)
    expect(oldInbox.data.sections.flatMap(section => section.cards)).toHaveLength(0)
    const newInbox = await send<WorkspacePage>('/api/workspace/inbox', 'GET', undefined, unrelated)
    expect(newInbox.data.sections[0].cards.find(card => card.id === reply?.id)?.links).toEqual(reply?.links)
    await send(codePath + contact.id, 'DELETE')
    expect((await bearer(portalPath, mine.data.secret)).status).toBe(401)
  })

  it('opens school tickets with photos, queues replies, supports handoffs and records school resolution', async () => {
    const [agent, nextAgent, finance] = await Promise.all([
      staff('SUPPORT'), staff('SUPPORT', 'handoff-support@example.test'), staff('FINANCE'),
    ])
    const otherSchool = await prisma.school.create({ data: { name: 'Other school', phone: '555', contactPerson: 'Other' } })
    const contacts = await prisma.contact.createManyAndReturn({ data: [
      { schoolId, name: 'Portal contact', phone: '123' },
      { schoolId, name: 'Colleague', phone: '124' },
      { schoolId: otherSchool.id, name: 'Outside contact', phone: '555' },
    ] })
    const codePath = '/api/workspace/portal/access/'
    const codes = await Promise.all(contacts.map(contact => send<{ secret: string }>(codePath + contact.id, 'POST', { days: 7 })))
    const [schoolCode, colleagueCode, otherCode] = codes.map(code => code.data.secret)
    const portalPath = '/api/portal/tickets'
    const input = { title: 'Cannot log in', category: 'Access & login', details: 'Error on the sign-in screen', requestId: randomUUID(),
      file: { name: 'screenshot.png', mimeType: 'image/png', base64: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]).toString('base64') } }
    expect((await bearer(portalPath, schoolCode, 'POST', { ...input, category: 'Unknown' })).status).toBe(400)
    const opened = await bearer<{ id: number }>(portalPath, schoolCode, 'POST', { ...input, schoolId: otherSchool.id, assignedToId: agent.id })
    expect(opened.status).toBe(201)
    expect((await bearer<{ id: number }>(portalPath, schoolCode, 'POST', input)).data.id).toBe(opened.data.id)
    const ticket = await prisma.schoolWork.findUniqueOrThrow({ where: { id: opened.data.id }, include: { files: true, messages: true } })
    expect(ticket).toMatchObject({ schoolId, kind: 'support', status: 'OPEN', supportCategory: input.category, assignedToId: null })
    expect(ticket.messages.map(message => message.text)).toEqual([input.details])
    expect(ticket.files).toHaveLength(1)
    expect(ticket.dueAt!.getTime() - ticket.createdAt.getTime()).toBeGreaterThan(23 * 60 * 60_000)
    const photoPath = portalPath + '/photos/' + ticket.files[0].id
    expect((await bearer(photoPath, schoolCode)).status).toBe(200)
    expect((await bearer(photoPath, otherCode)).status).toBe(404)

    const queuePath = '/api/operations/work/support'
    const staffPath = '/api/operations/work/' + ticket.id
    const queued = (await send<SchoolWork[]>(queuePath)).data.find(item => item.id === ticket.id)!
    expect(matchesSupportQueue(queued, 'unassigned')).toBe(true)
    expect(matchesSupportQueue(queued, 'waiting')).toBe(true)
    expect(matchesSupportQueue(queued, 'overdue', ticket.dueAt!.getTime() + 1)).toBe(true)
    expect((await send(staffPath, 'PATCH', { assignedToId: agent.id })).status).toBe(200)
    expect((await send(staffPath, 'PATCH', { assignedToId: finance.id }, agent)).status).toBe(400)
    expect((await send(staffPath, 'PATCH', { assignedToId: nextAgent.id }, agent)).status).toBe(200)
    expect((await send(staffPath + '/messages', 'GET', undefined, agent)).status).toBe(404)
    const transferred = await send<SupportMessagePage>(staffPath + '/messages', 'GET', undefined, nextAgent)
    expect(transferred.data.messages[0].text).toBe(input.details)

    const portalDevice = 'ExpoPushToken[fixture-school-device]'
    const otherDevice = 'ExpoPushToken[fixture-other-device]'
    expect((await bearer(portalPath + '/push-token', schoolCode, 'POST', { token: portalDevice })).status).toBe(200)
    expect((await bearer(portalPath + '/push-token', otherCode, 'POST', { token: otherDevice })).status).toBe(200)
    const push = vi.spyOn(pushService, 'sendBatch').mockResolvedValue([])
    const reply = { text: 'Please sign in again.', requestId: randomUUID() }
    try {
      expect((await send(staffPath + '/messages', 'POST', reply, nextAgent)).status).toBe(200)
      await vi.waitFor(() => expect(push).toHaveBeenCalledOnce())
      expect(push.mock.calls[0][0]).toEqual([expect.objectContaining({ to: portalDevice, data: { portalTicketId: ticket.id } })])
      expect((await send(staffPath + '/messages', 'POST', reply, nextAgent)).status).toBe(200)
      expect(push).toHaveBeenCalledOnce()
    } finally { push.mockRestore() }

    const readAlerts = async (code: string) => (await bearer<WorkspacePage>('/api/portal', code)).data.sections.find(section => section.title === 'Reply alerts')!.cards
    const alerts = await readAlerts(schoolCode)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].links?.[0].path).toBe('/portal?ticket=' + ticket.id)
    expect(await readAlerts(otherCode)).toHaveLength(0)
    expect((await bearer('/api' + alerts[0].actions![0].path, otherCode, 'POST')).status).toBe(404)
    expect((await bearer('/api' + alerts[0].actions![0].path, schoolCode, 'POST')).status).toBe(200)
    expect(await readAlerts(schoolCode)).toHaveLength(0)
    expect(await readAlerts(colleagueCode)).toHaveLength(1)
    const answered = (await send<SchoolWork[]>(queuePath)).data.find(item => item.id === ticket.id)!
    expect(matchesSupportQueue(answered, 'waiting')).toBe(false)
    expect(matchesSupportQueue(answered, 'overdue', ticket.dueAt!.getTime() + 1)).toBe(false)

    const resolution = portalPath + '/' + ticket.id + '/resolution/'
    expect((await bearer(resolution + 'confirm', schoolCode, 'POST')).status).toBe(409)
    expect((await send(staffPath, 'PATCH', { status: 'RESOLVED' }, nextAgent)).status).toBe(200)
    expect((await bearer(resolution + 'confirm', otherCode, 'POST')).status).toBe(409)
    expect((await bearer(resolution + 'reopen', schoolCode, 'POST', { details: 'The issue returned' })).status).toBe(200)
    expect((await prisma.schoolWork.findUniqueOrThrow({ where: { id: ticket.id } })).status).toBe('OPEN')
    expect((await send(staffPath, 'PATCH', { status: 'RESOLVED' }, nextAgent)).status).toBe(200)
    expect((await bearer(resolution + 'confirm', schoolCode, 'POST')).status).toBe(200)
    expect((await prisma.schoolWork.findUniqueOrThrow({ where: { id: ticket.id } })).status).toBe('CLOSED')
    expect((await send(codePath + contacts[0].id, 'POST', { days: 7 })).status).toBe(200)
    expect(await prisma.portalPushDevice.findUnique({ where: { token: portalDevice } })).toBeNull()
    expect((await bearer('/api/portal', schoolCode)).status).toBe(401)
  })
})
