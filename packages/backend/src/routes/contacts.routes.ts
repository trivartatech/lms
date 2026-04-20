import { Router } from 'express'
import { contactsController } from '../controllers/contacts.controller'
import { authenticate } from '../middleware/auth.middleware'

const router = Router()

router.use(authenticate)

router.get('/school/:schoolId', contactsController.getBySchool)
router.get('/lead/:leadId', contactsController.getByLead)
router.post('/', contactsController.create)
router.put('/:id', contactsController.update)
router.delete('/:id', contactsController.remove)

export default router
