import { assignedRecord } from '../middleware/workspace-access'
import { Router } from 'express'
import { contactsController } from '../controllers/contacts.controller'
import { authenticate } from '../middleware/auth.middleware'
import { idempotency } from '../middleware/idempotency.middleware'

const router = Router()

router.use(authenticate, assignedRecord('contact'))
router.use(idempotency)

router.get('/school/:schoolId', contactsController.getBySchool)
router.get('/lead/:leadId', contactsController.getByLead)
router.post('/', contactsController.create)
router.put('/:id', contactsController.update)
router.delete('/:id', contactsController.remove)

export default router
