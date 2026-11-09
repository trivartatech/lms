import { assignedRecord } from '../middleware/workspace-access'
import { z } from 'zod'
import { quotationWorkflow } from '../services/quotation-workflow.service'
import { requireRole } from '../middleware/rbac.middleware'
import { quotationsService } from '../services/quotations.service'
import { apiNumbers } from '../lib/api-numbers'
import { Router } from 'express'
import { quotationsController } from '../controllers/quotations.controller'
import { authenticate } from '../middleware/auth.middleware'
import { idempotency } from '../middleware/idempotency.middleware'
import { validate } from '../middleware/validate.middleware'
import { quotationListQuerySchema } from '../validators/queries'

const router = Router()

router.use(authenticate, assignedRecord('quotation'))
router.use(idempotency)

router.get('/', validate(quotationListQuerySchema, 'query'), quotationsController.getAll)
router.post('/', quotationsController.create)
const workflowParams = z.object({ id: z.coerce.number().int().positive() })
const versionParams = workflowParams.extend({ versionId: z.coerce.number().int().positive() })

router.get('/:id/workflow', validate(workflowParams, 'params'), async (req, res, next) => {
  try { res.json(await quotationWorkflow.info(Number(req.params.id))) } catch (err) { next(err) }
})
router.get('/:id/versions/:versionId', validate(versionParams, 'params'), async (req, res, next) => {
  try { res.json(await quotationWorkflow.version(Number(req.params.id), Number(req.params.versionId))) } catch (err) { next(err) }
})
router.post('/:id/duplicate', validate(workflowParams, 'params'), async (req, res, next) => {
  try {
    const quote = await quotationsService.getById(Number(req.params.id))
    const copy = await quotationsService.create({
      leadId: quote.leadId ?? undefined, schoolId: quote.schoolId ?? undefined,
      discount: Number(quote.discount), tax: Number(quote.tax),
      items: quote.items.map(({ name, type, quantity, unitPrice }) => ({ name, type, quantity, unitPrice: Number(unitPrice) })),
    }, req.user.id)
    res.status(201).json(apiNumbers(copy))
  } catch (err) { next(err) }
})
router.post('/:id/approval', validate(workflowParams, 'params'), async (req, res, next) => {
  try { res.json(await quotationWorkflow.request(Number(req.params.id))) } catch (err) { next(err) }
})
router.patch('/:id/approval', requireRole('ADMIN', 'SALES_MANAGER'), validate(workflowParams, 'params'),
  validate(z.object({ approved: z.boolean(), reviewedAt: z.string().datetime() })), async (req, res, next) => {
    try { res.json(await quotationWorkflow.decide(Number(req.params.id), req.body.approved, req.user.id, req.body.reviewedAt)) } catch (err) { next(err) }
  })
router.post('/:id/shared', validate(workflowParams, 'params'), validate(z.object({ updatedAt: z.string().datetime() })), async (req, res, next) => {
  try { res.json(await quotationWorkflow.shared(Number(req.params.id), req.body.updatedAt, req.user.id)) } catch (err) { next(err) }
})

router.get('/:id', quotationsController.getById)
router.put('/:id', quotationsController.update)
router.delete('/:id', quotationsController.remove)
router.post('/:id/send-email', quotationsController.sendEmail)
router.post('/:id/send-whatsapp', quotationsController.sendWhatsApp)

export default router
