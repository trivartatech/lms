import { Router } from 'express'
import { agreementsController } from '../controllers/agreements.controller'
import { authenticate } from '../middleware/auth.middleware'
import { validate } from '../middleware/validate.middleware'
import { agreementListQuerySchema } from '../validators/queries'

const router = Router()

router.use(authenticate)

router.get('/', validate(agreementListQuerySchema, 'query'), agreementsController.getAll)
router.post('/', agreementsController.create)
router.get('/:id', agreementsController.getById)
router.put('/:id', agreementsController.update)
router.post('/:id/send-email', agreementsController.sendEmail)
router.post('/:id/send-whatsapp', agreementsController.sendWhatsApp)

export default router
