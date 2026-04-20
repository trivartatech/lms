export type BonusType = 'FIXED' | 'PERCENTAGE'
export type PayoutStatus = 'PENDING' | 'PAID'
export type ReferralStatus = 'NEW' | 'IN_PROGRESS' | 'CONVERTED' | 'LOST'

export interface ReferralIncentive {
  id: number
  referringSchoolId: number
  referringSchool?: { id: number; name: string }
  leadId: number
  convertedSchoolId?: number
  bonusType: BonusType
  bonusValue: number
  calculatedCommission?: number
  payoutStatus: PayoutStatus
  createdAt: string
}

export interface ReferralListItem {
  leadId: number
  schoolName: string
  contactPerson: string
  phone: string
  status: ReferralStatus
  pipelineStage: string
  dealValue?: number
  commission?: number
  payoutStatus: PayoutStatus
  createdAt: string
  incentiveId?: number
}

export interface CreateReferralDto {
  schoolName: string
  contactPerson: string
  phone: string
  email?: string
  location?: string
  notes?: string
  bonusType: BonusType
  bonusValue: number
}

export interface ReferralDashboard {
  totalReferrals: number
  converted: number
  conversionRate: number
  totalCommissionPending: number
  totalCommissionPaid: number
  topReferrers: TopReferrer[]
}

export interface TopReferrer {
  schoolId: number
  schoolName: string
  totalReferrals: number
  converted: number
  conversionRate: number
  totalRevenue: number
  totalCommission: number
}
