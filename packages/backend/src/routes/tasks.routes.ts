import { Router } from 'express'
import { tasksController } from '../controllers/tasks.controller'
import { authenticate } from '../middleware/auth.middleware'
import { validate } from '../middleware/validate.middleware'
import { taskListQuerySchema } from '../validators/queries'

const router = Router()

router.use(authenticate)

router.get('/', validate(taskListQuerySchema, 'query'), tasksController.getAll)
router.post('/', tasksController.create)
router.get('/:id', tasksController.getById)
router.put('/:id', tasksController.update)
router.delete('/:id', tasksController.remove)

export default router
