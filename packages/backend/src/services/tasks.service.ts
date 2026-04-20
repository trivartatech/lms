import { prisma } from '../config/prisma'
import { AppError } from '../middleware/error.middleware'
import { timelineService, computeDiff } from './timeline.service'

const taskInclude = {
  assignedTo: { select: { id: true, name: true, email: true, role: true } },
  lead: { select: { id: true, schoolName: true } },
  school: { select: { id: true, name: true } },
}

export const tasksService = {
  async getAll(params: { leadId?: number; schoolId?: number; assignedTo?: number; status?: string }) {
    const where: any = {}
    if (params.leadId) where.leadId = params.leadId
    if (params.schoolId) where.schoolId = params.schoolId
    if (params.assignedTo) where.assignedToId = params.assignedTo
    if (params.status) where.status = params.status

    return prisma.task.findMany({ where, include: taskInclude, orderBy: { dueDate: 'asc' } })
  },

  async getById(id: number) {
    const task = await prisma.task.findUnique({ where: { id }, include: taskInclude })
    if (!task) throw new AppError(404, 'Task not found')
    return task
  },

  async create(
    data: {
      title: string
      type: string
      dueDate: string
      notes?: string
      assignedToId?: number
      leadId?: number
      schoolId?: number
    },
    userId: number,
  ) {
    const task = await prisma.task.create({
      data: { ...data, dueDate: new Date(data.dueDate), type: data.type as any },
      include: taskInclude,
    })

    if (data.leadId) {
      await timelineService.logEvent({
        leadId: data.leadId,
        eventType: 'TASK_ADDED',
        description: `Task added: ${data.title} (${data.type}) due ${data.dueDate}`,
        createdById: userId,
      })
    }
    if (data.schoolId) {
      await timelineService.logEvent({
        schoolId: data.schoolId,
        eventType: 'TASK_ADDED',
        description: `Task added: ${data.title} (${data.type}) due ${data.dueDate}`,
        createdById: userId,
      })
    }

    return task
  },

  async update(id: number, data: any, userId: number) {
    const existing = await prisma.task.findUnique({ where: { id } })
    if (!existing) throw new AppError(404, 'Task not found')

    if (data.dueDate) data.dueDate = new Date(data.dueDate)

    const task = await prisma.task.update({ where: { id }, data, include: taskInclude })

    const diff = computeDiff(
      existing as unknown as Record<string, unknown>,
      data as Record<string, unknown>,
    )

    const target = existing.leadId ?? existing.schoolId
    const field = existing.leadId ? 'leadId' : 'schoolId'

    if (data.status === 'COMPLETED' && existing.status !== 'COMPLETED') {
      if (target) {
        await timelineService.logEvent({
          [field]: target,
          eventType: 'TASK_COMPLETED',
          description: `Task completed: ${existing.title}`,
          createdById: userId,
          diff,
        })
      }
    } else if (Object.keys(diff).length > 0 && target) {
      await timelineService.logEvent({
        [field]: target,
        eventType: 'TASK_UPDATED',
        description: `Task updated: ${existing.title} (${Object.keys(diff).join(', ')})`,
        createdById: userId,
        diff,
      })
    }

    return task
  },

  async remove(id: number) {
    const task = await prisma.task.findUnique({ where: { id } })
    if (!task) throw new AppError(404, 'Task not found')
    await prisma.task.delete({ where: { id } })
  },
}
