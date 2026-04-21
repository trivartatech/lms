import { Router } from 'express'
import { addonsController } from '../controllers/addons.controller'
import { authenticate } from '../middleware/auth.middleware'
import { idempotency } from '../middleware/idempotency.middleware'
import { requireRole } from '../middleware/rbac.middleware'

const router = Router()

router.use(authenticate)
router.use(idempotency)

router.get('/', addonsController.getAll)
router.get('/:id', addonsController.getById)
router.post('/', requireRole('ADMIN', 'SALES_MANAGER'), addonsController.create)
router.put('/:id', requireRole('ADMIN', 'SALES_MANAGER'), addonsController.update)
router.delete('/:id', requireRole('ADMIN'), addonsController.remove)

export default router
