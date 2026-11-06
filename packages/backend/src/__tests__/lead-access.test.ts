import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('../config/prisma', () => ({ prisma: { lead: { findUnique: vi.fn() }, idempotencyKey: { findUnique: vi.fn(), create: vi.fn() } } }))
import { prisma } from '../config/prisma'
import { leadAccess } from '../middleware/lead-access.middleware'
import { idempotency } from '../middleware/idempotency.middleware'
const db = prisma as any
const request = (path = '/12') => ({ path, method: 'GET', user: { id: 1, role: 'SALES_EXECUTIVE' }, body: {} }) as any
beforeEach(() => { vi.resetAllMocks() })
describe('lead ownership', () => {
  it('hides another salesperson’s lead', async () => {
    db.lead.findUnique.mockResolvedValue({ assignedToId: 2 })
    const next = vi.fn()
    await leadAccess(request(), {} as any, next)
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 404 })
  })
  it('allows the assigned salesperson', async () => {
    db.lead.findUnique.mockResolvedValue({ assignedToId: 1 })
    const next = vi.fn()
    await leadAccess(request('/12/timeline'), {} as any, next)
    expect(next).toHaveBeenCalledWith()
  })
  it('blocks bulk changes by salespeople', async () => {
    const next = vi.fn()
    await leadAccess(request('/bulk'), {} as any, next)
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 403 })
  })
})
describe('concurrent offline retries', () => {
  it('does not execute a mutation when another request wins the reservation', async () => {
    db.idempotencyKey.findUnique.mockResolvedValue(null)
    db.idempotencyKey.create.mockRejectedValue({ code: 'P2002' })
    const req = { ...request('/'), method: 'POST', originalUrl: '/api/leads', header: () => 'stable-key-123' }
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() }
    const next = vi.fn()
    await idempotency(req, res, next)
    expect(res.status).toHaveBeenCalledWith(409)
    expect(next).not.toHaveBeenCalled()
  })
})

