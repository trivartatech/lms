import { agreementPaymentsService } from '../services/agreement-payments.service'
import { apiNumbers } from '../lib/api-numbers'
import { Router } from 'express'
import { agreementsController } from '../controllers/agreements.controller'
import { authenticate } from '../middleware/auth.middleware'
import { idempotency } from '../middleware/idempotency.middleware'
import { validate } from '../middleware/validate.middleware'
import { agreementListQuerySchema } from '../validators/queries'

const router = Router()

router.use(authenticate)
router.use(idempotency)

router.get('/', validate(agreementListQuerySchema, 'query'), agreementsController.getAll)
router.post('/', agreementsController.create)
router.get('/:id/payments', async (req, res, next) => { try { res.json(apiNumbers(await agreementPaymentsService.get(Number(req.params.id)))) } catch (e) { next(e) } })
router.post('/:id/payments', async (req, res, next) => { try { res.status(201).json(apiNumbers(await agreementPaymentsService.add(Number(req.params.id), req.body, req.user.id))) } catch (e) { next(e) } })
router.put('/:id/payments/:paymentId/receive', async (req, res, next) => { try { res.json(apiNumbers(await agreementPaymentsService.receive(Number(req.params.id), Number(req.params.paymentId), req.user.id))) } catch (e) { next(e) } })
router.delete('/:id/payments/:paymentId', async (req, res, next) => { try { await agreementPaymentsService.remove(Number(req.params.id), Number(req.params.paymentId)); res.status(204).send() } catch (e) { next(e) } })
router.get('/:id', agreementsController.getById)
router.put('/:id', agreementsController.update)
router.post('/:id/send-email', agreementsController.sendEmail)
router.post('/:id/send-whatsapp', agreementsController.sendWhatsApp)

export default router
