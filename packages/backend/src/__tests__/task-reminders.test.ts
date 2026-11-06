import { beforeEach, expect, it, vi } from 'vitest'
vi.mock('../config/prisma', () => ({ prisma: { task: { findMany: vi.fn(), updateMany: vi.fn() } } }))
vi.mock('../services/push.service', () => ({ pushService: { sendBatch: vi.fn() } }))
import { prisma } from '../config/prisma'
import { pushService } from '../services/push.service'
import { runTaskReminders } from '../jobs/taskReminders'
const db = prisma as any
beforeEach(() => {
  vi.clearAllMocks()
  db.task.findMany.mockResolvedValue([1, 2].map(id => ({ id, title: 'Reminder', dueDate: new Date(Date.now() + 3600000), assignedTo: { pushToken: 'ExponentPushToken[abcdefghijklmnopqrstuv]' }, school: { name: 'Test' } })))
  db.task.updateMany.mockResolvedValue({ count: 1 })
})
it('marks only accepted push notifications as sent', async () => {
  ;(pushService.sendBatch as any).mockResolvedValue([{ status: 'ok', id: 'ticket' }, { status: 'error', message: 'Try again' }])
  expect(await runTaskReminders()).toEqual({ sent: 1 })
  expect(db.task.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: [1] } } }))
})
it('leaves failed notifications available for retry', async () => {
  ;(pushService.sendBatch as any).mockResolvedValue([{ status: 'error' }, { status: 'error' }])
  expect(await runTaskReminders()).toEqual({ sent: 0 })
  expect(db.task.updateMany).not.toHaveBeenCalled()
})
