import { Request, Response, NextFunction } from 'express'
import { reportsService } from '../services/reports.service'
import { referralsService } from '../services/referrals.service'

export const reportsController = {
  async getDashboardStats(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await reportsService.getDashboardStats())
    } catch (err) {
      next(err)
    }
  },

  async getReferralDashboard(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await referralsService.getDashboard())
    } catch (err) {
      next(err)
    }
  },

  async getSalesReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { from, to, assignedTo } = req.query as any
      res.json(
        await reportsService.getSalesReport({
          from,
          to,
          assignedTo: assignedTo ? parseInt(assignedTo) : undefined,
        }),
      )
    } catch (err) {
      next(err)
    }
  },

  async getReferralReport(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await referralsService.getDashboard())
    } catch (err) {
      next(err)
    }
  },

  async getRevenueReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { from, to } = req.query as any
      res.json(await reportsService.getRevenueReport({ from, to }))
    } catch (err) {
      next(err)
    }
  },

  async getActivityFeed(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, leadId, schoolId } = req.query as any
      res.json(
        await reportsService.getActivityFeed({
          page: page ? parseInt(page) : undefined,
          limit: limit ? parseInt(limit) : undefined,
          leadId: leadId ? parseInt(leadId) : undefined,
          schoolId: schoolId ? parseInt(schoolId) : undefined,
        }),
      )
    } catch (err) {
      next(err)
    }
  },

  async updateIncentivePayout(req: Request, res: Response, next: NextFunction) {
    try {
      const { payoutStatus } = req.body
      const result = await referralsService.updateIncentivePayout(parseInt(req.params.id), payoutStatus)
      res.json(result)
    } catch (err) {
      next(err)
    }
  },
}
