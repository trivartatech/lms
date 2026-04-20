import { Router } from 'express'
import authRoutes from './auth.routes'
import leadsRoutes from './leads.routes'
import schoolsRoutes from './schools.routes'
import quotationsRoutes from './quotations.routes'
import agreementsRoutes from './agreements.routes'
import addonsRoutes from './addons.routes'
import tasksRoutes from './tasks.routes'
import usersRoutes from './users.routes'
import reportsRoutes from './reports.routes'
import contactsRoutes from './contacts.routes'

const router = Router()

router.use('/auth', authRoutes)
router.use('/leads', leadsRoutes)
router.use('/schools', schoolsRoutes)
router.use('/quotations', quotationsRoutes)
router.use('/agreements', agreementsRoutes)
router.use('/addons', addonsRoutes)
router.use('/tasks', tasksRoutes)
router.use('/users', usersRoutes)
router.use('/contacts', contactsRoutes)
router.use('/', reportsRoutes)

export default router
