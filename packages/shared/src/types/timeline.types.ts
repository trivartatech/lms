import { UserSummary } from './user.types'

export type TimelineEventType =
  | 'LEAD_CREATED'
  | 'LEAD_UPDATED'
  | 'STAGE_CHANGED'
  | 'LEAD_CONVERTED'
  | 'TASK_ADDED'
  | 'TASK_COMPLETED'
  | 'QUOTATION_CREATED'
  | 'QUOTATION_SENT'
  | 'QUOTATION_ACCEPTED'
  | 'AGREEMENT_CREATED'
  | 'AGREEMENT_RENEWED'
  | 'REFERRAL_CREATED'
  | 'NOTE_ADDED'

export interface TimelineEvent {
  id: number
  leadId?: number
  schoolId?: number
  eventType: TimelineEventType
  description: string
  createdBy?: UserSummary
  createdAt: string
}
