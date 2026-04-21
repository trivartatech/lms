import { Router } from 'express'
import { leadsController } from '../controllers/leads.controller'
import { authenticate } from '../middleware/auth.middleware'
import { idempotency } from '../middleware/idempotency.middleware'
import { requireRole } from '../middleware/rbac.middleware'
import { validate } from '../middleware/validate.middleware'
import { leadListQuerySchema } from '../validators/queries'

const router = Router()

router.use(authenticate)
router.use(idempotency)

router.get('/', validate(leadListQuerySchema, 'query'), leadsController.getAll)
router.post('/', leadsController.create)
router.post('/bulk', leadsController.bulkAction)
router.post('/import', leadsController.importLeads)
router.get('/:id', leadsController.getById)
router.put('/:id', leadsController.update)
router.delete('/:id', requireRole('ADMIN'), leadsController.remove)
router.post('/:id/convert', requireRole('ADMIN', 'SALES_MANAGER'), leadsController.convert)
router.get('/:id/timeline', leadsController.getTimeline)
router.get('/:id/referrals', leadsController.getReferrals)
router.post('/:id/referrals', leadsController.createReferral)
router.get('/:id/addons', leadsController.getAddons)
router.post('/:id/addons', leadsController.addAddon)
router.delete('/:id/addons/:addonId', leadsController.removeAddon)

export default router
