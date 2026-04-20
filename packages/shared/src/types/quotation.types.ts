export type QuotationStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED'
export type QuotationItemType = 'ERP' | 'ADDON'

export interface QuotationItem {
  id: number
  quotationId: number
  name: string
  type: QuotationItemType
  quantity: number
  unitPrice: number
  total: number
}

export interface Quotation {
  id: number
  leadId?: number
  schoolId?: number
  subtotal: number
  discount: number
  tax: number
  total: number
  status: QuotationStatus
  items: QuotationItem[]
  lead?: { id: number; schoolName: string; contactPerson: string; phone: string; email: string; location?: string | null; totalStudents?: number | null } | null
  school?: { id: number; name: string; contactPerson: string; phone: string; email: string; location?: string | null; totalStudents?: number | null } | null
  createdAt: string
  updatedAt: string
}

export interface CreateQuotationItemDto {
  name: string
  type: QuotationItemType
  quantity: number
  unitPrice: number
}

export interface CreateQuotationDto {
  leadId?: number
  schoolId?: number
  discount?: number
  tax?: number
  items: CreateQuotationItemDto[]
}

export interface UpdateQuotationDto {
  discount?: number
  tax?: number
  status?: QuotationStatus
  items?: CreateQuotationItemDto[]
}
