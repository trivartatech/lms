import { env } from '../config/env'

/**
 * Mag91 WhatsApp Business API wrapper.
 *
 * Mag91 is an Indian WhatsApp BSP. The REST surface varies slightly by account
 * type (text campaign vs. template); we expose a narrow sendText/sendTemplate
 * helper. If no API key is configured, we no-op + log (dev-safe fallback).
 */

export interface SendTextParams {
  /** E.164 phone number, e.g. "919876543210" */
  phone: string
  message: string
}

export interface SendTemplateParams {
  phone: string
  templateName: string
  /** Positional body params. Mag91 fills {{1}}, {{2}}… with these. */
  variables?: string[]
  mediaUrl?: string
}

async function postJson(endpoint: string, payload: Record<string, unknown>) {
  const url = `${env.MAG91_BASE_URL.replace(/\/+$/, '')}${endpoint}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.MAG91_API_KEY}`,
    },
    body: JSON.stringify(payload),
  })
  const text = await res.text()
  let body: unknown
  try { body = JSON.parse(text) } catch { body = text }
  if (!res.ok) {
    throw new Error(`Mag91 ${endpoint} failed (${res.status}): ${text}`)
  }
  return body as Record<string, unknown>
}

export const mag91Service = {
  get configured() {
    return Boolean(env.MAG91_API_KEY && env.MAG91_SENDER_ID)
  },

  async sendText(params: SendTextParams) {
    if (!this.configured) {
      console.warn('[mag91] not configured — skipping sendText to', params.phone)
      return { skipped: true as const }
    }
    return postJson('/v1/messages/text', {
      sender: env.MAG91_SENDER_ID,
      recipient: params.phone,
      message: params.message,
    })
  },

  async sendTemplate(params: SendTemplateParams) {
    if (!this.configured) {
      console.warn('[mag91] not configured — skipping sendTemplate to', params.phone)
      return { skipped: true as const }
    }
    return postJson('/v1/messages/template', {
      sender:    env.MAG91_SENDER_ID,
      recipient: params.phone,
      template:  params.templateName,
      variables: params.variables ?? [],
      mediaUrl:  params.mediaUrl,
    })
  },
}
