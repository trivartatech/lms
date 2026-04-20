import { Request, Response, NextFunction } from 'express'
import { schoolsService } from '../services/schools.service'
import { referralsService } from '../services/referrals.service'

export const schoolsController = {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { search, page, limit } = req.query as any
      const result = await schoolsService.getAll({
        search,
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 20,
      })
      res.json(result)
    } catch (err) {
      next(err)
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const school = await schoolsService.getById(parseInt(req.params.id))
      res.json(school)
    } catch (err) {
      next(err)
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const school = await schoolsService.create(req.body)
      res.status(201).json(school)
    } catch (err) {
      next(err)
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const school = await schoolsService.update(parseInt(req.params.id), req.body, req.user?.id)
      res.json(school)
    } catch (err) {
      next(err)
    }
  },

  async getAgreements(req: Request, res: Response, next: NextFunction) {
    try {
      const agreements = await schoolsService.getAgreements(parseInt(req.params.id))
      res.json(agreements)
    } catch (err) {
      next(err)
    }
  },

  async getAddons(req: Request, res: Response, next: NextFunction) {
    try {
      const addons = await schoolsService.getAddons(parseInt(req.params.id))
      res.json(addons)
    } catch (err) {
      next(err)
    }
  },

  async addAddon(req: Request, res: Response, next: NextFunction) {
    try {
      const addon = await schoolsService.addAddon(parseInt(req.params.id), req.body)
      res.status(201).json(addon)
    } catch (err) {
      next(err)
    }
  },

  async removeAddon(req: Request, res: Response, next: NextFunction) {
    try {
      await schoolsService.removeAddon(parseInt(req.params.id), parseInt(req.params.addonId))
      res.status(204).send()
    } catch (err) {
      next(err)
    }
  },

  async getTimeline(req: Request, res: Response, next: NextFunction) {
    try {
      const events = await schoolsService.getTimeline(parseInt(req.params.id))
      res.json(events)
    } catch (err) {
      next(err)
    }
  },

  async getTasks(req: Request, res: Response, next: NextFunction) {
    try {
      const tasks = await schoolsService.getTasks(parseInt(req.params.id))
      res.json(tasks)
    } catch (err) {
      next(err)
    }
  },

  async getReferrals(req: Request, res: Response, next: NextFunction) {
    try {
      const referrals = await referralsService.getSchoolReferrals(parseInt(req.params.id))
      res.json(referrals)
    } catch (err) {
      next(err)
    }
  },

  async createReferral(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await referralsService.createReferral(
        parseInt(req.params.id),
        req.body,
        req.user.id,
      )
      res.status(201).json(result)
    } catch (err) {
      next(err)
    }
  },
}
