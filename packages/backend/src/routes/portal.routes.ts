
import portalSupport, { portalSupportSections, type SchoolContact } from './portal-support'
import { ticketChat } from './ticket-chat'
import { Router, type RequestHandler } from 'express'
import { z } from 'zod'
import type { QuotationVersion, WorkspacePage } from '@lms/shared'
import { prisma } from '../config/prisma'
import { decodeSchoolFile, schoolUpload } from '../lib/school-file'
import { AppError } from '../middleware/error.middleware'
import { action, displayDate, displayMoney, field, handle, id, note, parse } from './workspace/common'
import { portalTokenHash } from './workspace/portal-admin'

export const portalAuthenticate: RequestHandler = async (req, res, next) => {
  try {
    if (res.locals.schoolContact) return next()
    const token = req.header('Authorization')?.slice(7) ?? ''
    if (!req.header('Authorization')?.startsWith('Bearer ') || !/^lms_school_[0-9a-f]{64}$/.test(token)) {
      throw new AppError(401, 'Enter a valid school access code')
    }
    const access = await prisma.schoolPortalAccess.findUnique({
      where: { tokenHash: portalTokenHash(token) },
      include: { contact: { select: { id: true, name: true, schoolId: true, school: { select: { name: true } } } } },
    })
    if (!access || access.expiresAt <= new Date() || access.contact.schoolId !== access.schoolId || !access.contact.school) {
      throw new AppError(401, 'School access expired or was revoked')
    }
    res.set('Cache-Control', 'private, no-store')
    res.locals.schoolContact = { id: access.contact.id, name: access.contact.name, schoolId: access.schoolId, schoolName: access.contact.school.name, accessId: access.id, accessHash: access.tokenHash }
    next()
  } catch (error) { next(error) }
}

const router = Router()
router.use(portalAuthenticate)
router.use('/tickets/:id/messages', ticketChat((_req, res) => {
  const contact = res.locals.schoolContact as SchoolContact
  return { id: contact.id, type: 'SCHOOL', name: contact.name, scope: { schoolId: contact.schoolId } }
}))

router.use('/tickets', portalSupport)

router.get('/', handle(async (_req, res) => {
  const contact = res.locals.schoolContact as SchoolContact
  const [quotes, files, support] = await Promise.all([
    prisma.portalQuote.findMany({
      where: { schoolId: contact.schoolId, published: true },
      include: { version: { select: { quotationId: true, number: true, snapshot: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.portalDocument.findMany({
      where: { schoolId: contact.schoolId }, select: { fileId: true, file: { select: { name: true, category: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    portalSupportSections(contact),
  ])
  const page: WorkspacePage = {
    title: contact.schoolName, description: 'School portal · Signed in as ' + contact.name,
    draftOwner: 'school-' + contact.schoolId + '-' + contact.id,
    sections: [
      { title: 'Shared quotations', cards: quotes.map(q => {
        const { quotation, pdfBase64 } = JSON.parse(q.version.snapshot) as QuotationVersion
        return {
          id: 'quote-' + q.id, title: 'Quotation #' + q.version.quotationId + ' · V' + q.version.number,
          subtitle: 'Total · ' + displayMoney(quotation.total), badge: q.response.replace(/_/g, ' '),
          lines: [...quotation.items.map(i => i.name + ' · ' + i.quantity + ' × ' + displayMoney(i.unitPrice)),
            'Discount · ' + displayMoney(quotation.discount) + ' · Tax · ' + displayMoney(quotation.tax),
            ...(q.responseNote ? [q.responseNote] : [])],
          actions: q.response === 'PENDING' ? [
            { ...action('Accept this version', '/portal/quotes/' + q.id + '/accept'), confirm: 'Accept the prices and items in version ' + q.version.number + '?' },
            action('Request changes', '/portal/quotes/' + q.id + '/changes', [field('note', 'What should change?', 'textarea', { required: true })]),
          ] : [],
          links: pdfBase64 ? [{ label: 'Download quotation PDF', path: '/portal/quotes/' + q.id + '/pdf', downloadName: 'quotation-' + q.version.quotationId + '-v' + q.version.number + '.pdf' }] : [],
        }
      }) },
      { title: 'Documents', cards: [
        { id: 'upload', title: 'Send a document to your school team', actions: [action('Upload document', '/portal/documents', [field('file', 'PDF or photo (up to 5 MB)', 'file', { required: true })])] },
        ...files.map(f => ({ id: 'file-' + f.fileId, title: f.file.name, subtitle: f.file.category,
          links: [{ label: 'Download', path: '/portal/documents/' + f.fileId, downloadName: f.file.name }] })),
      ] },
      ...support,
    ],
  }
  res.json(page)
}))

router.post('/quotes/:id/:decision', handle(async (req, res) => {
  const contact = res.locals.schoolContact as SchoolContact
  const quoteId = parse(id, req.params.id)
  const decision = parse(z.enum(['accept', 'changes']), req.params.decision)
  const response = decision === 'accept' ? 'ACCEPTED' : 'CHANGES_REQUESTED'
  const responseNote = decision === 'changes' ? parse(note.min(1), req.body.note) : null
  const result = await prisma.portalQuote.updateMany({
    where: { id: quoteId, schoolId: contact.schoolId, published: true, response: 'PENDING' },
    data: { response, responseNote, respondedBy: contact.name, respondedAt: new Date() },
  })
  if (!result.count) throw new AppError(409, 'This quotation is unavailable or already has a response')
  res.json({ message: decision === 'accept' ? 'Quotation accepted' : 'Changes requested' })
}))

router.get('/quotes/:id/pdf', handle(async (req, res) => {
  const contact = res.locals.schoolContact as SchoolContact
  const quote = await prisma.portalQuote.findFirst({
    where: { id: parse(id, req.params.id), schoolId: contact.schoolId, published: true }, include: { version: true },
  })
  const pdf = quote ? (JSON.parse(quote.version.snapshot) as QuotationVersion).pdfBase64 : undefined
  if (!quote || !pdf) throw new AppError(404, 'Quotation PDF not found')
  res.attachment('quotation-' + quote.version.quotationId + '-v' + quote.version.number + '.pdf').type('application/pdf').send(Buffer.from(pdf, 'base64'))
}))

router.post('/documents', handle(async (req, res) => {
  const contact = res.locals.schoolContact as SchoolContact
  const file = decodeSchoolFile(parse(schoolUpload, req.body.file))
  const saved = await prisma.schoolFile.create({
    data: { ...file, schoolId: contact.schoolId, category: 'Portal upload', uploadedById: 0,
      portalDocument: { create: { schoolId: contact.schoolId, uploadedBySchool: true } } },
    select: { id: true },
  })
  res.status(201).json({ id: saved.id, message: 'Document uploaded' })
}))

router.get('/documents/:id', handle(async (req, res) => {
  const contact = res.locals.schoolContact as SchoolContact
  const doc = await prisma.portalDocument.findFirst({
    where: { fileId: parse(id, req.params.id), schoolId: contact.schoolId }, include: { file: true },
  })
  if (!doc) throw new AppError(404, 'Document not found')
  res.attachment(doc.file.name).type(doc.file.mimeType).send(Buffer.from(doc.file.content))
}))

export default router
