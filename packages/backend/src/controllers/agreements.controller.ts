import { Request, Response, NextFunction } from 'express'
import { agreementsService } from '../services/agreements.service'
import { mailerService } from '../services/mailer.service'
import { mag91Service } from '../services/mag91.service'
import { timelineService } from '../services/timeline.service'
import { AppError } from '../middleware/error.middleware'

export const agreementsController = {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { schoolId } = req.query as any
      const result = await agreementsService.getAll({
        schoolId: schoolId ? parseInt(schoolId) : undefined,
      })
      res.json(result)
    } catch (err) {
      next(err)
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const a = await agreementsService.getById(parseInt(req.params.id))
      res.json(a)
    } catch (err) {
      next(err)
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const a = await agreementsService.create(req.body, req.user.id)
      res.status(201).json(a)
    } catch (err) {
      next(err)
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const a = await agreementsService.update(parseInt(req.params.id), req.body, req.user.id)
      res.json(a)
    } catch (err) {
      next(err)
    }
  },

  /**
   * Email the agreement PDF. Client posts the rendered PDF as base64.
   * Body: { to, subject?, message?, pdfBase64?, pdfFilename? }
   */
  async sendEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id)
      const { to, subject, message, pdfBase64, pdfFilename } = req.body as {
        to: string
        subject?: string
        message?: string
        pdfBase64?: string
        pdfFilename?: string
      }
      if (!to) throw new AppError(400, 'Recipient "to" is required')

      const agreement = await agreementsService.getById(id)
      const finalSubject = subject ?? `Agreement — ${agreement.school?.name ?? `#${id}`}`
      const finalText = message ?? `Please find attached the agreement document (#${id}).`

      const attachments = pdfBase64
        ? [{
            filename: pdfFilename ?? `agreement-${id}.pdf`,
            content: Buffer.from(pdfBase64, 'base64'),
            contentType: 'application/pdf',
          }]
        : undefined

      const result = await mailerService.send({ to, subject: finalSubject, text: finalText, attachments })

      await timelineService.logEvent({
        schoolId: agreement.schoolId,
        eventType: 'AGREEMENT_EMAILED',
        description: `Agreement #${id} emailed to ${to}`,
        createdById: req.user.id,
      })

      res.json({ sent: true, ...result })
    } catch (err) {
      next(err)
    }
  },

  /**
   * Send a WhatsApp notification about the agreement via Mag91.
   * Body: { phone: string, message?: string }
   */
  async sendWhatsApp(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id)
      const { phone, message } = req.body as { phone: string; message?: string }
      if (!phone) throw new AppError(400, 'Recipient "phone" is required')

      const agreement = await agreementsService.getById(id)
      const body = message ??
        `Agreement #${id} for ${agreement.school?.name ?? 'your school'} — Value ₹${agreement.value}, valid ${agreement.startDate.toDateString()} to ${agreement.endDate.toDateString()}.`

      const result = await mag91Service.sendText({ phone, message: body })

      await timelineService.logEvent({
        schoolId: agreement.schoolId,
        eventType: 'AGREEMENT_WHATSAPP_SENT',
        description: `Agreement #${id} WhatsApp sent to ${phone}`,
        createdById: req.user.id,
      })

      res.json({ sent: true, result })
    } catch (err) {
      next(err)
    }
  },
}
