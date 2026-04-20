import { Router } from 'express'
import { schoolsController } from '../controllers/schools.controller'
import { authenticate } from '../middleware/auth.middleware'
import { validate } from '../middleware/validate.middleware'
import { schoolListQuerySchema } from '../validators/queries'

const router = Router()

router.use(authenticate)

router.get('/', validate(schoolListQuerySchema, 'query'), schoolsController.getAll)
router.post('/', schoolsController.create)
router.get('/:id', schoolsController.getById)
router.put('/:id', schoolsController.update)
router.get('/:id/agreements', schoolsController.getAgreements)
router.get('/:id/addons', schoolsController.getAddons)
router.post('/:id/addons', schoolsController.addAddon)
router.delete('/:id/addons/:addonId', schoolsController.removeAddon)
router.get('/:id/timeline', schoolsController.getTimeline)
router.get('/:id/tasks', schoolsController.getTasks)
router.get('/:id/referrals', schoolsController.getReferrals)
router.post('/:id/referrals', schoolsController.createReferral)

export default router
