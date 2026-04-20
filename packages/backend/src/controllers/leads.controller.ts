import { Request, Response, NextFunction } from 'express'
import { leadsService } from '../services/leads.service'

export const leadsController = {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      // query is pre-validated + typed by leadListQuerySchema in routes
      const { stage, status, assignedTo, search, page, limit } = req.query as unknown as {
        stage?: string
        status?: string
        assignedTo?: number
        search?: string
        page: number
        limit: number
      }
      const result = await leadsService.getAll({
        stage,
        status,
        assignedTo,
        search,
        page,
        limit,
        userId: req.user.id,
        userRole: req.user.role,
      })
      res.json(result)
    } catch (err) {
      next(err)
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const lead = await leadsService.getById(parseInt(req.params.id))
      res.json(lead)
    } catch (err) {
      next(err)
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const lead = await leadsService.create(req.body, req.user.id)
      res.status(201).json(lead)
    } catch (err) {
      next(err)
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const lead = await leadsService.update(parseInt(req.params.id), req.body, req.user.id)
      res.json(lead)
    } catch (err) {
      next(err)
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await leadsService.remove(parseInt(req.params.id))
      res.status(204).send()
    } catch (err) {
      next(err)
    }
  },

  async convert(req: Request, res: Response, next: NextFunction) {
    try {
      const school = await leadsService.convertToSchool(parseInt(req.params.id), req.user.id)
      res.status(201).json(school)
    } catch (err) {
      next(err)
    }
  },

  async bulkAction(req: Request, res: Response, next: NextFunction) {
    try {
      const { ids, action, ...payload } = req.body
      res.json(await leadsService.bulkAction(ids, action, payload))
    } catch (err) {
      next(err)
    }
  },

  async importLeads(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await leadsService.importLeads(req.body, req.user.id))
    } catch (err) {
      next(err)
    }
  },

  async getTimeline(req: Request, res: Response, next: NextFunction) {
    try {
      const { timelineService } = await import('../services/timeline.service')
      const events = await timelineService.getLeadTimeline(parseInt(req.params.id))
      res.json(events)
    } catch (err) {
      next(err)
    }
  },

  async getAddons(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await leadsService.getAddons(parseInt(req.params.id)))
    } catch (err) { next(err) }
  },

  async addAddon(req: Request, res: Response, next: NextFunction) {
    try {
      const addon = await leadsService.addAddon(parseInt(req.params.id), req.body)
      res.status(201).json(addon)
    } catch (err) { next(err) }
  },

  async removeAddon(req: Request, res: Response, next: NextFunction) {
    try {
      await leadsService.removeAddon(parseInt(req.params.id), parseInt(req.params.addonId))
      res.status(204).send()
    } catch (err) { next(err) }
  },

  async getReferrals(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await leadsService.getLeadReferrals(parseInt(req.params.id)))
    } catch (err) { next(err) }
  },

  async createReferral(req: Request, res: Response, next: NextFunction) {
    try {
      const lead = await leadsService.createLeadReferral(parseInt(req.params.id), req.body, req.user.id)
      res.status(201).json(lead)
    } catch (err) { next(err) }
  },
}
