
import { Router } from 'express'
import { WORKSPACE_MODULES, workspaceModules, type WorkspaceModule } from '@lms/shared'
import { prisma } from '../config/prisma'
import { authenticate } from '../middleware/auth.middleware'
import { idempotency } from '../middleware/idempotency.middleware'
import { AppError } from '../middleware/error.middleware'
import { handle, schoolScope, timelineScope } from './workspace/common'
import renewals from './workspace/renewals'
import portal from './workspace/portal-admin'
import orders from './workspace/orders'
import receipts from './workspace/receipts'
import targets from './workspace/targets'
import { inboxRouter, timelineRouter } from './workspace/overview'

const router = Router()
router.use(authenticate)
router.use((req, _res, next) => {
  const section = req.path.split('/')[1]
  if (section === 'index' || workspaceModules(req.user.role).includes(section as WorkspaceModule)) return next()
  next(new AppError(403, 'This workspace is unavailable for your role'))
})
router.use((req, res, next) => {
  if (req.method === 'POST' && /^\/portal\/access\/\d+\/?$/.test(req.path)) return next()
  return idempotency(req, res, next)
})
router.get('/index', handle(async (req, res) => {
  const scope = req.user.role === 'SUPPORT' ? timelineScope(req.user) : schoolScope(req.user)
  const schools = await prisma.school.findMany({ where: scope, select: { id: true, name: true }, orderBy: { name: 'asc' } })
  res.json({ schools, modules: workspaceModules(req.user.role) })
}))
const sections: Record<keyof typeof WORKSPACE_MODULES, Router> = {
  renewals, portal, orders, receipts, targets, inbox: inboxRouter, timeline: timelineRouter,
}
for (const [name, section] of Object.entries(sections)) router.use('/' + name, section)

export default router
