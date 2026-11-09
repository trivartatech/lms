
import { randomBytes, createHash } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import type { QuotationVersion, WorkspacePage } from '@lms/shared'
import { prisma } from '../../config/prisma'
import { AppError } from '../../middleware/error.middleware'
import { quotationWorkflow } from '../../services/quotation-workflow.service'
import { action, displayDate, displayMoney, field, handle, id, option, parse, schoolFilter, schoolFor, schoolScope } from './common'

const router = Router()
export const portalTokenHash = (token: string) => createHash('sha256').update(token).digest('hex')

router.get('/', handle(async (req, res) => {
  const schoolId = schoolFilter(req)
  const sections: WorkspacePage['sections'] = []
  if (schoolId) {
    await schoolFor(req.user, schoolId)
    const [contacts, versions, files, quotes, publishedFiles] = await Promise.all([
      prisma.contact.findMany({
        where: { schoolId },
        select: { id: true, name: true, email: true, portalAccess: { select: { expiresAt: true } } },
        orderBy: { name: 'asc' },
      }),
      prisma.quotationVersion.findMany({
        where: { quotation: { schoolId }, event: { in: ['SENT', 'EMAIL', 'WHATSAPP', 'SHARED', 'ACCEPTED'] } },
        select: { id: true, number: true, quotationId: true }, orderBy: [{ quotationId: 'desc' }, { number: 'desc' }],
      }),
      prisma.schoolFile.findMany({ where: { schoolId, workId: null, category: { not: 'Payment proof' } }, select: { id: true, name: true, category: true }, orderBy: { name: 'asc' } }),
      prisma.portalQuote.findMany({
        where: { schoolId },
        select: { id: true, version: { select: { number: true, quotationId: true, snapshot: true } }, response: true, respondedAt: true, responseNote: true, respondedBy: true, published: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.portalDocument.findMany({
        where: { schoolId },
        select: { fileId: true, uploadedBySchool: true, file: { select: { name: true } } },
      }),
    ])
    sections.push({
      title: 'School contact access',
      cards: contacts.map(contact => {
        const path = '/workspace/portal/access/' + contact.id
        const active = contact.portalAccess && contact.portalAccess.expiresAt > new Date()
        return {
          id: 'contact-' + contact.id, title: contact.name, subtitle: contact.email ?? undefined,
          lines: [active ? 'Access expires ' + displayDate(contact.portalAccess?.expiresAt) : 'Access inactive'],
          actions: [
            { ...action(active ? 'Replace access code' : 'Create access code', path, [field('days', 'Expires in days (1–90)', 'number', { value: '30', required: true })]),
              confirm: active ? 'Replacing the code ends access with the previous code.' : undefined },
            ...(active ? [{ ...action('Revoke access', path, undefined, 'DELETE'), confirm: 'Revoke portal access for this contact?' }] : []),
          ],
        }
      }),
    })
    const availableVersions = versions.filter(version => !quotes.some(q => q.published && q.version.quotationId === version.quotationId && q.version.number === version.number))
    const availableFiles = files.filter(file => !publishedFiles.some(p => p.fileId === file.id))
    sections.push({
      title: 'Publish to this school',
      cards: [{
        id: 'publish', title: 'Choose exactly what school contacts can see',
        lines: ['Prepare a PDF or mark a quotation sent to create a shareable version.', 'Upload a document in School operations to make it available here.'],
        actions: [
          ...(availableVersions.length ? [action('Publish quotation version', '/workspace/portal/publish-quote/' + schoolId, [
            field('versionId', 'Quotation version', 'select', { required: true, options: availableVersions.map(v => option(v.id, 'Quotation #' + v.quotationId + ' · V' + v.number)) }),
          ])] : []),
          ...(availableFiles.length ? [action('Share document', '/workspace/portal/publish-file/' + schoolId, [
            field('fileId', 'Document', 'select', { required: true, options: availableFiles.map(f => option(f.id, f.name + ' · ' + f.category)) }),
          ])] : []),
        ],
      }],
    })
    sections.push({
      title: 'Quotation responses',
      cards: quotes.map(q => {
        const snapshot = JSON.parse(q.version.snapshot) as Pick<QuotationVersion, 'quotation'>
        return {
          id: 'quote-' + q.id, title: 'Quotation #' + q.version.quotationId + ' · V' + q.version.number,
          subtitle: displayMoney(snapshot.quotation.total), badge: q.response.replace(/_/g, ' '),
          lines: [q.published ? 'Visible to school contacts' : 'Hidden from school contacts',
            ...(q.respondedAt ? [(q.respondedBy ?? 'School contact') + ' · ' + displayDate(q.respondedAt)] : []),
            ...(q.responseNote ? [q.responseNote] : []),
          ],
          actions: q.published && q.response !== 'ACCEPTED' ? [{ ...action('Hide version', '/workspace/portal/quotes/' + q.id, undefined, 'DELETE'), confirm: 'Hide this quotation from the school portal?' }] : [],
          links: [{ label: 'Open staff quotation', path: '/quotations/' + q.version.quotationId }],
        }
      }),
    })
    sections.push({
      title: 'Shared documents and school uploads',
      cards: publishedFiles.map(f => ({
        id: 'document-' + f.fileId, title: f.file.name, badge: f.uploadedBySchool ? 'Uploaded by school' : 'Shared with school',
        links: [{ label: 'Download', path: '/workspace/portal/files/' + f.fileId, downloadName: f.file.name }],
        actions: [{ ...action('Remove from portal', '/workspace/portal/files/' + f.fileId, undefined, 'DELETE'), confirm: 'Remove this document from the school portal?' }],
      })),
    })
  }
  res.json({
    title: 'School portal', description: schoolId ? 'Create contact access codes and manage the records shared with this school.' : 'Choose a school to manage contact access and shared records.',
    sections,
  } satisfies WorkspacePage)
}))

async function contactFor(req: Parameters<Parameters<typeof handle>[0]>[0]) {
  const contact = await prisma.contact.findFirst({
    where: { id: parse(id, req.params.id), school: schoolScope(req.user), schoolId: { not: null } },
    select: { id: true, name: true, schoolId: true },
  })
  if (!contact || contact.schoolId == null) throw new AppError(404, 'School contact not found')
  return { ...contact, schoolId: contact.schoolId }
}

router.post('/access/:id', handle(async (req, res) => {
  const contact = await contactFor(req)
  const days = parse(z.coerce.number().int().min(1).max(90), req.body.days)
  const secret = 'lms_school_' + randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + days * 86400000)
  await prisma.$transaction(async tx => {
    const access = await tx.schoolPortalAccess.upsert({
      where: { contactId: contact.id },
      create: { contactId: contact.id, schoolId: contact.schoolId, tokenHash: portalTokenHash(secret), expiresAt },
      update: { schoolId: contact.schoolId, tokenHash: portalTokenHash(secret), expiresAt },
    })
    await tx.portalPushDevice.deleteMany({ where: { accessId: access.id } })
  })
  res.set('Cache-Control', 'no-store').json({ secret, expiresAt, message: 'Access code for ' + contact.name })
}))

router.delete('/access/:id', handle(async (req, res) => {
  const contact = await contactFor(req)
  await prisma.schoolPortalAccess.deleteMany({ where: { contactId: contact.id } })
  res.json({ message: 'Access revoked' })
}))

router.post('/publish-quote/:id', handle(async (req, res) => {
  const school = await schoolFor(req.user, parse(id, req.params.id))
  const versionId = parse(id, req.body.versionId)
  const version = await prisma.quotationVersion.findFirst({
    where: { id: versionId, quotation: { schoolId: school.id }, event: { in: ['SENT', 'EMAIL', 'WHATSAPP', 'SHARED', 'ACCEPTED'] } },
    select: { quotationId: true },
  })
  if (!version) throw new AppError(404, 'Shareable quotation version not found')
  const verified = await quotationWorkflow.version(version.quotationId, versionId)
  if (!verified.canExport) throw new AppError(409, 'This version requires approval before publishing')
  await prisma.portalQuote.upsert({
    where: { versionId }, create: { schoolId: school.id, versionId }, update: { published: true },
  })
  res.json({ message: 'Quotation version published' })
}))

router.delete('/quotes/:id', handle(async (req, res) => {
  const result = await prisma.portalQuote.updateMany({
    where: { id: parse(id, req.params.id), school: schoolScope(req.user), response: { not: 'ACCEPTED' } },
    data: { published: false },
  })
  if (!result.count) throw new AppError(404, 'Quotation cannot be hidden')
  res.json({ message: 'Quotation hidden' })
}))

router.post('/publish-file/:id', handle(async (req, res) => {
  const school = await schoolFor(req.user, parse(id, req.params.id))
  const file = await prisma.schoolFile.findFirst({ where: { id: parse(id, req.body.fileId), schoolId: school.id, workId: null, category: { not: 'Payment proof' } } })
  if (!file) throw new AppError(404, 'School document not found')
  await prisma.portalDocument.upsert({ where: { fileId: file.id }, create: { fileId: file.id, schoolId: school.id }, update: {} })
  res.json({ message: 'Document shared' })
}))

router.get('/files/:id', handle(async (req, res) => {
  const doc = await prisma.portalDocument.findFirst({ where: { fileId: parse(id, req.params.id), school: schoolScope(req.user) }, include: { file: true } })
  if (!doc) throw new AppError(404, 'Shared document not found')
  res.set('Cache-Control', 'private, no-store').attachment(doc.file.name).type(doc.file.mimeType).send(Buffer.from(doc.file.content))
}))

router.delete('/files/:id', handle(async (req, res) => {
  const result = await prisma.portalDocument.deleteMany({ where: { fileId: parse(id, req.params.id), school: schoolScope(req.user) } })
  if (!result.count) throw new AppError(404, 'Shared document not found')
  res.json({ message: 'Document removed from the portal' })
}))

export default router
