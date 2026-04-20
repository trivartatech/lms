import { Request, Response, NextFunction } from 'express'
import { tasksService } from '../services/tasks.service'

export const tasksController = {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { leadId, schoolId, assignedTo, status } = req.query as any
      const result = await tasksService.getAll({
        leadId: leadId ? parseInt(leadId) : undefined,
        schoolId: schoolId ? parseInt(schoolId) : undefined,
        assignedTo: assignedTo ? parseInt(assignedTo) : undefined,
        status,
      })
      res.json(result)
    } catch (err) {
      next(err)
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await tasksService.getById(parseInt(req.params.id)))
    } catch (err) {
      next(err)
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json(await tasksService.create(req.body, req.user.id))
    } catch (err) {
      next(err)
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await tasksService.update(parseInt(req.params.id), req.body, req.user.id))
    } catch (err) {
      next(err)
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await tasksService.remove(parseInt(req.params.id))
      res.status(204).send()
    } catch (err) {
      next(err)
    }
  },
}
