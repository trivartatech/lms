
import type { Quotation } from './quotation.types'

export interface QuotationVersionSummary {
  id: number
  number: number
  event: 'BASELINE' | 'REVISION' | 'SENT' | 'EMAIL' | 'WHATSAPP' | 'SHARED' | 'ACCEPTED'
  createdAt: string
}

export interface QuotationWorkflow {
  requiresApproval: boolean
  discountLimit: number
  approvalStatus: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED'
  approvedById: number | null
  approvedAt: string | null
  versions: QuotationVersionSummary[]
}

export interface QuotationVersion extends QuotationVersionSummary {
  quotation: Quotation
  canExport: boolean
  pdfBase64?: string
}
