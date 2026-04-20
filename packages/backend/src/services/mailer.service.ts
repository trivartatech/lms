import nodemailer, { Transporter } from 'nodemailer'
import { env } from '../config/env'

let cached: Transporter | null = null

function getTransport(): Transporter {
  if (cached) return cached
  if (!env.SMTP_HOST || !env.SMTP_USER) {
    // Fallback: JSON transport — logs the message instead of sending.
    // Useful in dev when SMTP isn't configured. Will never throw on send.
    cached = nodemailer.createTransport({ jsonTransport: true })
    return cached
  }
  cached = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: (env.SMTP_PORT ?? 587) === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  })
  return cached
}

export interface MailAttachment {
  filename: string
  content: Buffer | string
  encoding?: string
  contentType?: string
}

export interface SendMailParams {
  to: string | string[]
  subject: string
  text?: string
  html?: string
  attachments?: MailAttachment[]
}

export const mailerService = {
  async send(params: SendMailParams) {
    const transport = getTransport()
    const info = await transport.sendMail({
      from: env.SMTP_FROM ?? env.SMTP_USER ?? 'no-reply@lms.local',
      to: Array.isArray(params.to) ? params.to.join(',') : params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
      attachments: params.attachments,
    })
    return { messageId: info.messageId, accepted: info.accepted, rejected: info.rejected }
  },
}
