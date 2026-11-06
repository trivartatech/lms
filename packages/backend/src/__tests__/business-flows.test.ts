import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Decimal } from '@prisma/client/runtime/library'
import { apiNumbers } from '../lib/api-numbers'
import { validateAgreement } from '../validators/agreement'
import { validateQuotation } from '../validators/quotation'
vi.mock('../config/prisma', () => ({ prisma: { task: { findUnique: vi.fn(), update: vi.fn() } } }))
vi.mock('../services/timeline.service', () => ({ timelineService: { logEvent: vi.fn() }, computeDiff: () => ({}) }))
import { prisma } from '../config/prisma'
import { tasksService } from '../services/tasks.service'

it('sends numeric money values for web/mobile arithmetic, preserving dates', () => {
  const date = new Date('2026-11-06')
  const result = apiNumbers({ tax: new Decimal('180'), items: [{ unitPrice: new Decimal('0.1') }], date })
  expect(JSON.parse(JSON.stringify(result))).toEqual({ tax: 180, items: [{ unitPrice: 0.1 }], date: date.toISOString() })
})
describe('agreement payment/date validation', () => {
  const valid = { startDate: '2026-01-01', endDate: '2027-01-01', value: 1000, advancePayment: 100, totalInstalments: 0 }
  it('allows zero instalments', () => expect(() => validateAgreement(valid)).not.toThrow())
  it.each([{ advancePayment: 1001 }, { advancePayment: -1 }, { totalInstalments: 1.5 }, { endDate: '2025-01-01' }, { startDate: 'invalid' }])('rejects invalid agreements: %j', patch => {
    expect(() => validateAgreement({ ...valid, ...patch })).toThrow()
  })
})
describe('quotation validation', () => {
  const valid = { items: [{ name: 'ERP', quantity: 10, unitPrice: 100 }], discount: 100, tax: 162 }
  it('accepts tax as a currency amount', () => expect(() => validateQuotation(valid)).not.toThrow())
  it.each([{ discount: 1001 }, { tax: -1 }, { items: [] }, { items: [{ name: 'ERP', quantity: 1.5, unitPrice: 100 }] }])('rejects invalid quotation: %j', patch => {
    expect(() => validateQuotation({ ...valid, ...patch })).toThrow()
  })
})
describe('task reminders after edits', () => {
  const db = prisma as any
  beforeEach(() => { vi.clearAllMocks(); db.task.findUnique.mockResolvedValue({ dueDate: new Date('2026-11-06T10:00:00Z'), status: 'PENDING', assignedToId: 1 }); db.task.update.mockResolvedValue({ id: 1 }) })
  it('resets reminder delivery when rescheduled', async () => {
    await tasksService.update(1, { dueDate: '2026-11-07T10:00:00Z' }, 1)
    expect(db.task.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ reminderSentAt: null }) }))
  })
  it('keeps delivery state for unrelated edits', async () => {
    await tasksService.update(1, { title: 'Updated' }, 1)
    expect(db.task.update.mock.calls[0][0].data).not.toHaveProperty('reminderSentAt')
  })
})
