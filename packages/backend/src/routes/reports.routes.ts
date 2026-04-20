import { Router } from 'express'
import { reportsController } from '../controllers/reports.controller'
import { authenticate } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/rbac.middleware'

const router = Router()

router.use(authenticate)

router.get('/dashboard/stats', reportsController.getDashboardStats)
router.get('/activity', reportsController.getActivityFeed)
router.get('/dashboard/referrals', requireRole('ADMIN', 'SALES_MANAGER'), reportsController.getReferralDashboard)
router.get('/sales', requireRole('ADMIN', 'SALES_MANAGER'), reportsController.getSalesReport)
router.get('/referrals', requireRole('ADMIN', 'SALES_MANAGER'), reportsController.getReferralReport)
router.get('/revenue', requireRole('ADMIN', 'SALES_MANAGER'), reportsController.getRevenueReport)
router.put('/referral-incentives/:id', requireRole('ADMIN', 'SALES_MANAGER'), reportsController.updateIncentivePayout)

export default router
