import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { Expo } from 'expo-server-sdk'
import { z } from 'zod'
import { SUPPORT_CATEGORIES, SUPPORT_MESSAGE_MAX_LENGTH, type WorkspacePage } from '@lms/shared'
import { prisma } from '../config/prisma'
import { decodeSchoolFile, schoolUpload } from '../lib/school-file'
import { AppError } from '../middleware/error.middleware'
import { action, displayDate, field, handle, id, option, parse } from './workspace/common'

export type SchoolContact = { id: number; name: string; schoolId: number; schoolName: string; accessId: number; accessHash: string }

const router = Router()
const requestId = z.string().uuid()
const intake = z.object({
  requestId, title: z.string().trim().min(1).max(180), category: z.enum(SUPPORT_CATEGORIES),
  details: z.string().trim().min(1).max(SUPPORT_MESSAGE_MAX_LENGTH),
  file: schoolUpload.refine(file => file.mimeType !== 'application/pdf', 'Choose a JPEG or PNG photo').optional(),
})
const pushToken = z.string().max(256).refine(Expo.isExpoPushToken, 'Invalid device token')
const schoolPhoto = 'School ticket photo'

export async function portalSupportSections(contact: SchoolContact): Promise<WorkspacePage['sections']> {
  const [tickets, replies] = await Promise.all([
    prisma.schoolWork.findMany({
      where: { schoolId: contact.schoolId, kind: 'support' },
      select: { id: true, title: true, status: true, dueAt: true, supportCategory: true,
        files: { where: { category: schoolPhoto }, select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.supportMessage.findMany({
      where: { senderType: 'STAFF', work: { schoolId: contact.schoolId, kind: 'support' },
        portalReads: { none: { accessId: contact.accessId } } },
      select: { id: true, work: { select: { id: true, title: true } } },
      orderBy: { id: 'desc' }, take: 50,
    }),
  ])
  return [
    { title: 'Reply alerts', cards: replies.map(reply => ({
      id: 'reply-' + reply.id, title: 'Support replied', subtitle: reply.work.title, badge: 'Unread',
      links: [{ label: 'Open ticket chat', path: '/portal?ticket=' + reply.work.id }],
      actions: [action('Mark read', '/portal/tickets/replies/' + reply.id + '/read')],
    })) },
    { title: 'Support tickets', cards: [
      { id: 'open-ticket', title: 'Need help?', actions: [{
        ...action('Open a ticket', '/portal/tickets', [
          field('title', 'Issue title', 'text', { required: true }),
          field('category', 'Category', 'select', { required: true, options: SUPPORT_CATEGORIES.map(category => option(category, category)) }),
          field('details', 'Describe the issue', 'textarea', { required: true }),
          field('file', 'Photo (optional)', 'file', { imagesOnly: true }),
        ]),
        requestId: true,
      }] },
      ...tickets.map(ticket => ({
        id: 'ticket-' + ticket.id, title: ticket.title, badge: ticket.status.replace(/_/g, ' '),
        subtitle: ticket.supportCategory ?? undefined,
        lines: [
          ...(ticket.dueAt && ['OPEN', 'IN_PROGRESS'].includes(ticket.status) ? ['Response due · ' + displayDate(ticket.dueAt)] : []),
          ...(ticket.status === 'RESOLVED' ? ['Support marked this issue resolved. Let us know if you still need help.'] : []),
        ],
        ticketChatPath: '/portal/tickets/' + ticket.id + '/messages',
        links: ticket.files.map(file => ({
          label: 'Open ' + file.name, path: '/portal/tickets/photos/' + file.id, downloadName: file.name,
        })),
        actions: ticket.status === 'RESOLVED' ? [
          { ...action('Confirm resolved', '/portal/tickets/' + ticket.id + '/resolution/confirm'), confirm: 'Close this ticket as resolved?' },
          action('Still need help', '/portal/tickets/' + ticket.id + '/resolution/reopen', [
            field('details', 'What still needs attention?', 'textarea', { required: true }),
          ]),
        ] : [],
      })),
    ] },
  ]
}

router.post('/', handle(async (req, res) => {
  const contact = res.locals.schoolContact as SchoolContact
  const body = parse(intake, req.body)
  const photo = body.file ? decodeSchoolFile(body.file) : undefined
  const key = { portalContactId: contact.id, portalRequestId: body.requestId }
  const ticket = await prisma.$transaction(async tx => {
    const existing = await tx.schoolWork.findUnique({
      where: { portalContactId_portalRequestId: key }, select: { id: true, schoolId: true },
    })
    if (existing) {
      if (existing.schoolId !== contact.schoolId) throw new AppError(409, 'Start a new ticket request')
      return existing
    }
    return tx.schoolWork.create({
      data: {
        ...key, schoolId: contact.schoolId, title: body.title, kind: 'support', status: 'OPEN',
        supportCategory: body.category, dueAt: new Date(Date.now() + 24 * 60 * 60_000), createdById: 0,
        messages: { create: { senderType: 'SCHOOL', senderId: contact.id, senderName: contact.name,
          requestId: body.requestId, text: body.details } },
        events: { create: { status: 'OPEN', notes: 'Ticket opened by ' + contact.name + ' in the School Portal', createdById: 0 } },
        files: photo ? { create: { ...photo, schoolId: contact.schoolId, category: schoolPhoto, uploadedById: 0 } } : undefined,
      },
      select: { id: true },
    })
  })
  res.status(201).json({ id: ticket.id, message: 'Support ticket opened' })
}))

router.post('/:id/resolution/:decision', handle(async (req, res) => {
  const contact = res.locals.schoolContact as SchoolContact
  const ticketId = parse(id, req.params.id)
  const decision = parse(z.enum(['confirm', 'reopen']), req.params.decision)
  const status = decision === 'confirm' ? 'CLOSED' : 'OPEN'
  const details = decision === 'reopen'
    ? parse(z.string().trim().min(1).max(SUPPORT_MESSAGE_MAX_LENGTH), req.body.details) : undefined
  await prisma.$transaction(async tx => {
    const result = await tx.schoolWork.updateMany({
      where: { id: ticketId, kind: 'support', schoolId: contact.schoolId, status: 'RESOLVED' },
      data: { status, dueAt: decision === 'reopen' ? new Date(Date.now() + 24 * 60 * 60_000) : undefined },
    })
    if (!result.count) throw new AppError(409, 'This ticket is no longer awaiting confirmation')
    await tx.schoolWorkEvent.create({ data: {
      workId: ticketId, status, createdById: 0,
      notes: decision === 'confirm' ? 'Resolution confirmed by ' + contact.name : 'Reopened by ' + contact.name,
    } })
    if (details) await tx.supportMessage.create({ data: {
      workId: ticketId, senderType: 'SCHOOL', senderId: contact.id, senderName: contact.name,
      requestId: randomUUID(), text: details,
    } })
  })
  res.json({ message: decision === 'confirm' ? 'Resolution confirmed' : 'Support ticket reopened' })
}))

router.get('/photos/:id', handle(async (req, res) => {
  const contact = res.locals.schoolContact as SchoolContact
  const file = await prisma.schoolFile.findFirst({
    where: { id: parse(id, req.params.id), schoolId: contact.schoolId, category: schoolPhoto, work: { kind: 'support', schoolId: contact.schoolId } },
  })
  if (!file) throw new AppError(404, 'Ticket photo not found')
  res.attachment(file.name).type(file.mimeType).send(Buffer.from(file.content))
}))

router.post('/replies/:id/read', handle(async (req, res) => {
  const contact = res.locals.schoolContact as SchoolContact
  const messageId = parse(id, req.params.id)
  const reply = await prisma.supportMessage.findFirst({
    where: { id: messageId, senderType: 'STAFF', work: { schoolId: contact.schoolId, kind: 'support' } },
    select: { id: true },
  })
  if (!reply) throw new AppError(404, 'Reply not found')
  const key = { accessId: contact.accessId, messageId }
  await prisma.portalReplyRead.upsert({ where: { accessId_messageId: key }, create: key, update: {} })
  res.json({ message: 'Reply marked read' })
}))

router.post('/push-token', handle(async (req, res) => {
  const contact = res.locals.schoolContact as SchoolContact
  const token = parse(pushToken, req.body.token)
  await prisma.$transaction(async tx => {
    const access = await tx.schoolPortalAccess.findFirst({
      where: { id: contact.accessId, tokenHash: contact.accessHash, expiresAt: { gt: new Date() }, contact: { schoolId: contact.schoolId } },
      select: { id: true },
    })
    if (!access) throw new AppError(401, 'School access expired or was revoked')
    await tx.portalPushDevice.upsert({ where: { token }, create: { token, accessId: access.id }, update: { accessId: access.id } })
    await tx.user.updateMany({ where: { pushToken: token }, data: { pushToken: null } })
  })
  res.json({ message: 'Phone alerts enabled' })
}))

router.delete('/push-token', handle(async (req, res) => {
  const contact = res.locals.schoolContact as SchoolContact
  await prisma.portalPushDevice.deleteMany({ where: { accessId: contact.accessId, token: parse(pushToken, req.body.token) } })
  res.json({ message: 'Phone alerts disabled' })
}))

export default router
