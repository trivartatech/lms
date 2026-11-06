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
import { localDateInput, rescheduleTaskDate, matchesTaskView } from '@lms/shared'
const { prisma } = config
let agreementId: number
let userId: number
const dbPath = (config as any).testDbPath as string
beforeAll(() => {
  execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy', '--schema', path.resolve('prisma/schema.prisma')], { env: { ...process.env, DATABASE_URL: `file:${dbPath.replace(/\\/g, '/')}` }, stdio: 'pipe' })
}, 30000)
afterAll(async () => { await prisma.$disconnect(); for (const suffix of ['', '-journal', '-wal', '-shm']) rmSync(dbPath + suffix, { force: true }) })
beforeEach(async () => {
  await prisma.agreement.deleteMany()
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
