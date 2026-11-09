import { Router, type Request, type Response } from 'express'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { SUPPORT_MESSAGE_MAX_LENGTH, type SupportMessage, type SupportMessagePage } from '@lms/shared'
import { prisma } from '../config/prisma'
import { pushService } from '../services/push.service'
import { AppError } from '../middleware/error.middleware'
import { handle, id, parse } from './workspace/common'

type Participant = { id: number; scope: Prisma.SchoolWorkWhereInput } &
  ({ type: 'STAFF' } | { type: 'SCHOOL'; name: string })

const pageSize = 30
const messageSelect = {
  id: true, senderType: true, senderId: true, senderName: true, text: true, createdAt: true,
} satisfies Prisma.SupportMessageSelect
const reply = z.object({
  text: z.string().trim().min(1).max(SUPPORT_MESSAGE_MAX_LENGTH),
  requestId: z.string().uuid(),
})

function forParticipant(message: Prisma.SupportMessageGetPayload<{ select: typeof messageSelect }>, participant: Participant): SupportMessage {
  const { id, senderType, senderId, senderName, text, createdAt } = message
  return { id, senderName, senderType: senderType === 'SCHOOL' ? 'SCHOOL' : 'STAFF', text,
    createdAt: createdAt.toISOString(), mine: senderType === participant.type && senderId === participant.id }
}

export function ticketChat(participantFor: (req: Request, res: Response) => Participant) {
  const router = Router({ mergeParams: true })
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'private, no-store')
    next()
  })

  router.get('/', handle(async (req, res) => {
    const participant = participantFor(req, res)
    const ticketId = parse(id, req.params.id)
    const before = parse(id.optional(), req.query.before)
    const ticket = await prisma.schoolWork.findFirst({
      where: { ...participant.scope, id: ticketId, kind: 'support' },
      select: { messages: {
        where: before ? { id: { lt: before } } : undefined,
        select: messageSelect, orderBy: { id: 'desc' }, take: pageSize + 1,
      } },
    })
    if (!ticket) throw new AppError(404, 'Support ticket not found')
    const messages = ticket.messages.slice(0, pageSize)
    res.json({
      messages: messages.map(message => forParticipant(message, participant)),
      nextBefore: ticket.messages.length > pageSize ? messages[pageSize - 1].id : null,
    } satisfies SupportMessagePage)
  }))

  router.post('/', handle(async (req, res) => {
    const participant = participantFor(req, res)
    const ticketId = parse(id, req.params.id)
    const { text, requestId } = parse(reply, req.body)
    const result = await prisma.$transaction(async tx => {
      const ticket = await tx.schoolWork.findFirst({
        where: { ...participant.scope, id: ticketId, kind: 'support' }, select: { id: true, schoolId: true },
      })
      if (!ticket) throw new AppError(404, 'Support ticket not found')
      const sender = participant.type === 'SCHOOL' ? participant :
        await tx.user.findUnique({ where: { id: participant.id }, select: { name: true } })
      if (!sender) throw new AppError(401, 'Account not found')

      const key = { workId: ticketId, senderType: participant.type, senderId: participant.id, requestId }
      const previous = await tx.supportMessage.findUnique({ where: { workId_senderType_senderId_requestId: key }, select: messageSelect })
      if (previous && previous.text !== text) throw new AppError(409, 'This message was already sent with different text')
      const message = previous ?? await tx.supportMessage.create({ data: { ...key, text, senderName: sender.name }, select: messageSelect })
      return { message, schoolId: ticket.schoolId, created: !previous }
    })
    res.json(forParticipant(result.message, participant))
    if (result.created && participant.type === 'STAFF') {
      void pushService.sendPortalTicketReply(result.schoolId, ticketId).catch(error => {
        console.error('[push] school reply alert failed:', error)
      })
    }
  }))
  return router
}
