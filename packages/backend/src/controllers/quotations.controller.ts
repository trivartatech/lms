import { Request, Response, NextFunction } from 'express'
import { quotationsService } from '../services/quotations.service'
import { mailerService } from '../services/mailer.service'
import { mag91Service } from '../services/mag91.service'
import { timelineService } from '../services/timeline.service'
import { AppError } from '../middleware/error.middleware'

export const quotationsController = {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { leadId, schoolId } = req.query as any
      const result = await quotationsService.getAll({
        leadId: leadId ? parseInt(leadId) : undefined,
        schoolId: schoolId ? parseInt(schoolId) : undefined,
      })
      res.json(result)
    } catch (err) {
      next(err)
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const q = await quotationsService.getById(parseInt(req.params.id))
      res.json(q)
    } catch (err) {
      next(err)
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const q = await quotationsService.create(req.body, req.user.id)
      res.status(201).json(q)
    } catch (err) {
      next(err)
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const q = await quotationsService.update(parseInt(req.params.id), req.body, req.user.id)
      res.json(q)
    } catch (err) {
      next(err)
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await quotationsService.remove(parseInt(req.params.id))
      res.status(204).send()
    } catch (err) {
      next(err)
    }
  },

  /**
   * Email the quotation PDF.
   * Client renders the PDF (via @react-pdf/renderer) and posts it back as base64
   * so we can attach it. `to, subject, message, pdfBase64, pdfFilename` in body.
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

      const quotation = await quotationsService.getById(id)
      const finalSubject = subject ?? `Quotation #${id}`
      const finalText = message ?? `Please find attached Quotation #${id}.\n\nTotal: ₹${quotation.total}`

      const attachments = pdfBase64
        ? [{
            filename: pdfFilename ?? `quotation-${id}.pdf`,
            content: Buffer.from(pdfBase64, 'base64'),
            contentType: 'application/pdf',
          }]
        : undefined

      const result = await mailerService.send({ to, subject: finalSubject, text: finalText, attachments })

      // Update status + timeline
      await quotationsService.update(id, { status: 'SENT' }, req.user.id)
      const entity = quotation.leadId ? { leadId: quotation.leadId } : { schoolId: quotation.schoolId ?? undefined }
      await timelineService.logEvent({
        ...entity,
        eventType: 'QUOTATION_EMAILED',
        description: `Quotation #${id} emailed to ${to}`,
        createdById: req.user.id,
      })

      res.json({ sent: true, ...result })
    } catch (err) {
      next(err)
    }
  },

  /**
   * Send a short WhatsApp notification via Mag91 with a link/ref to the quotation.
   * Body: { phone: string, message?: string }
   */
  async sendWhatsApp(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id)
      const { phone, message } = req.body as { phone: string; message?: string }
      if (!phone) throw new AppError(400, 'Recipient "phone" is required')

      const quotation = await quotationsService.getById(id)
      const body = message ?? `Quotation #${id} — Total ₹${quotation.total}. Reply for details.`

      const result = await mag91Service.sendText({ phone, message: body })

      const entity = quotation.leadId ? { leadId: quotation.leadId } : { schoolId: quotation.schoolId ?? undefined }
      await timelineService.logEvent({
        ...entity,
        eventType: 'QUOTATION_WHATSAPP_SENT',
        description: `Quotation #${id} WhatsApp sent to ${phone}`,
        createdById: req.user.id,
      })

      res.json({ sent: true, result })
    } catch (err) {
      next(err)
    }
  },
}
