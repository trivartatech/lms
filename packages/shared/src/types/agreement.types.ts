export type AgreementStatus = 'ACTIVE' | 'EXPIRED' | 'PENDING_RENEWAL'

export interface Agreement {
  id: number
  schoolId: number
  school?: {
    id: number
    name: string
    location?: string
    totalStudents?: number
    contactPerson: string
    phone: string
    schoolAddons?: Array<{ addon: { id: number; name: string; description?: string | null } }>
  }
  startDate:        string
  endDate:          string
  renewalDate?:     string
  status:           AgreementStatus
  value:            number
  advancePayment:   number
  totalInstalments: number
  notes?:           string
  createdAt:        string
  updatedAt:        string
}

export interface CreateAgreementDto {
  schoolId:         number
  startDate:        string
  endDate:          string
  renewalDate?:     string
  value:            number
  advancePayment?:  number
  totalInstalments?: number
  notes?:           string
}

export interface UpdateAgreementDto {
  startDate?:        string
  endDate?:          string
  renewalDate?:      string
  status?:           AgreementStatus
  value?:            number
  advancePayment?:   number
  totalInstalments?: number
  notes?:            string
}
