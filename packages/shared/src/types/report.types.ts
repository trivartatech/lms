export interface SalesReport {
  totalLeads: number
  convertedLeads: number
  conversionRate: number
  totalRevenue: number
  byStage: { stage: string; count: number }[]
  bySalesperson: { userId: number; name: string; leads: number; converted: number; revenue: number }[]
  byMonth: { month: string; leads: number; converted: number; revenue: number }[]
}

export interface ReferralReport {
  totalReferrals: number
  converted: number
  conversionRate: number
  totalCommissionPending: number
  totalCommissionPaid: number
  topReferrers: {
    schoolId: number
    schoolName: string
    totalReferrals: number
    converted: number
    conversionRate: number
    totalRevenue: number
    totalCommission: number
  }[]
}

export interface RevenueReport {
  totalRevenue: number
  byMonth: { month: string; revenue: number; agreements: number }[]
  byProduct: { name: string; type: string; revenue: number }[]
  upcomingRenewals: { schoolId: number; schoolName: string; renewalDate: string; value: number }[]
}

export interface DashboardStats {
  totalLeads: number
  newLeadsThisMonth: number
  totalSchools: number
  totalRevenue: number
  pendingTasks: number
  openDeals: number
  referralConversionRate: number
  /** Sum of calculatedCommission across incentives with payoutStatus = PENDING */
  pendingCommissionTotal: number
  /** Sum of calculatedCommission across incentives with payoutStatus = PAID */
  paidCommissionTotal: number
  totalReferrals: number
  convertedReferrals: number
  topReferringSchools: { id: number; name: string; referrals: number }[]
  pipelineByStage: { stage: string; count: number }[]
  overdueTasksCount: number
  upcomingRenewals: { schoolId: number; schoolName: string; renewalDate: string; value: number }[]
  tasksDueToday: number
}
