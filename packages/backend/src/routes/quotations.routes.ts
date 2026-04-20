import { Router } from 'express'
import { quotationsController } from '../controllers/quotations.controller'
import { authenticate } from '../middleware/auth.middleware'
import { validate } from '../middleware/validate.middleware'
import { quotationListQuerySchema } from '../validators/queries'

const router = Router()

router.use(authenticate)

router.get('/', validate(quotationListQuerySchema, 'query'), quotationsController.getAll)
router.post('/', quotationsController.create)
router.get('/:id', quotationsController.getById)
router.put('/:id', quotationsController.update)
router.delete('/:id', quotationsController.remove)
router.post('/:id/send-email', quotationsController.sendEmail)
router.post('/:id/send-whatsapp', quotationsController.sendWhatsApp)

export default router
