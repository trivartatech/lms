import { Request, Response, NextFunction } from 'express'
import { addonsService } from '../services/addons.service'

export const addonsController = {
  async getAll(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await addonsService.getAll())
    } catch (err) {
      next(err)
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await addonsService.getById(parseInt(req.params.id)))
    } catch (err) {
      next(err)
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json(await addonsService.create(req.body))
    } catch (err) {
      next(err)
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await addonsService.update(parseInt(req.params.id), req.body))
    } catch (err) {
      next(err)
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await addonsService.remove(parseInt(req.params.id))
      res.status(204).send()
    } catch (err) {
      next(err)
    }
  },
}
