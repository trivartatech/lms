import { Router } from 'express'
import { usersController } from '../controllers/users.controller'
import { authenticate } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/rbac.middleware'

const router = Router()

router.use(authenticate)

router.get('/', usersController.getAll)
router.put('/me/password', usersController.changePassword)
router.post('/me/push-token', usersController.registerPushToken)
router.delete('/me/push-token', usersController.clearPushToken)
router.post('/', requireRole('ADMIN'), usersController.create)
router.get('/:id', usersController.getById)
router.put('/:id', requireRole('ADMIN'), usersController.update)
router.delete('/:id', requireRole('ADMIN'), usersController.remove)

export default router
