import { prisma } from '../config/prisma'

export const reportsService = {
  async getDashboardStats() {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)

    const [
      totalLeads,
      newLeadsThisMonth,
      totalSchools,
      pendingTasks,
      openDeals,
      referralStats,
      topReferrers,
      revenueAgg,
      pipelineByStageRaw,
      overdueTasksCount,
      upcomingRenewalsRaw,
      tasksDueToday,
    ] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.school.count(),
      prisma.task.count({ where: { status: 'PENDING' } }),
      prisma.lead.count({ where: { status: { notIn: ['CONVERTED', 'LOST'] } } }),
      prisma.referralIncentive.aggregate({ _count: { id: true } }),
      prisma.referralIncentive.groupBy({
        by: ['referringSchoolId'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
      prisma.agreement.aggregate({ _sum: { value: true } }),
      prisma.lead.groupBy({
        by: ['pipelineStage'],
        _count: { id: true },
        where: { status: { notIn: ['CONVERTED', 'LOST'] } },
      }),
      prisma.task.count({ where: { dueDate: { lt: now }, status: 'PENDING' } }),
      prisma.agreement.findMany({
        where: { renewalDate: { gte: now, lte: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) }, status: 'ACTIVE' },
        include: { school: { select: { id: true, name: true } } },
        orderBy: { renewalDate: 'asc' },
        take: 5,
      }),
      prisma.task.count({ where: { dueDate: { gte: startOfToday, lt: endOfToday }, status: 'PENDING' } }),
    ])

    const [totalReferrals, convertedReferrals, pendingCommissionAgg, paidCommissionAgg] = await Promise.all([
      prisma.referralIncentive.count(),
      prisma.referralIncentive.count({ where: { convertedSchoolId: { not: null } } }),
      prisma.referralIncentive.aggregate({
        _sum: { calculatedCommission: true },
        where: { payoutStatus: 'PENDING', calculatedCommission: { not: null } },
      }),
      prisma.referralIncentive.aggregate({
        _sum: { calculatedCommission: true },
        where: { payoutStatus: 'PAID', calculatedCommission: { not: null } },
      }),
    ])

    const topReferrerDetails = await Promise.all(
      topReferrers.map(async (r) => {
        const school = await prisma.school.findUnique({
          where: { id: r.referringSchoolId },
          select: { id: true, name: true },
        })
        return { id: r.referringSchoolId, name: school?.name ?? 'Unknown', referrals: r._count.id }
      }),
    )

    const STAGE_ORDER = ['NEW', 'QUALIFIED', 'DEMO', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON']
    const stageMap = new Map(pipelineByStageRaw.map((r) => [r.pipelineStage, r._count.id]))
    const pipelineByStage = STAGE_ORDER.map((stage) => ({ stage, count: stageMap.get(stage) ?? 0 }))

    return {
      totalLeads,
      newLeadsThisMonth,
      totalSchools,
      totalRevenue: Number(revenueAgg._sum.value ?? 0),
      pendingTasks,
      openDeals,
      referralConversionRate:
        totalReferrals > 0 ? Math.round((convertedReferrals / totalReferrals) * 100) : 0,
      pendingCommissionTotal: Number(pendingCommissionAgg._sum.calculatedCommission ?? 0),
      paidCommissionTotal:    Number(paidCommissionAgg._sum.calculatedCommission ?? 0),
      totalReferrals,
      convertedReferrals,
      topReferringSchools: topReferrerDetails,
      pipelineByStage,
      overdueTasksCount,
      upcomingRenewals: upcomingRenewalsRaw.map((a) => ({
        schoolId: a.schoolId,
        schoolName: a.school.name,
        renewalDate: a.renewalDate?.toISOString() ?? '',
        value: Number(a.value),
      })),
      tasksDueToday,
    }
  },

  async getActivityFeed(params: { page?: number; limit?: number; leadId?: number; schoolId?: number }) {
    const { page = 1, limit = 30, leadId, schoolId } = params
    const skip = (page - 1) * limit
    const where: any = {}
    if (leadId) where.leadId = leadId
    if (schoolId) where.schoolId = schoolId

    const [events, total] = await Promise.all([
      prisma.timelineEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          createdBy: { select: { id: true, name: true } },
          lead: { select: { id: true, schoolName: true } },
          school: { select: { id: true, name: true } },
        },
      }),
      prisma.timelineEvent.count({ where }),
    ])

    return { data: events, total, page, limit }
  },

  async getSalesReport(params: { from?: string; to?: string; assignedTo?: number }) {
    const where: any = {}
    if (params.from || params.to) {
      where.createdAt = {}
      if (params.from) where.createdAt.gte = new Date(params.from)
      if (params.to) where.createdAt.lte = new Date(params.to)
    }
    if (params.assignedTo) where.assignedToId = params.assignedTo

    const [totalLeads, convertedLeads, byStageRaw, bySalespersonRaw] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.count({ where: { ...where, status: 'CONVERTED' } }),
      prisma.lead.groupBy({ by: ['pipelineStage'], _count: { id: true }, where }),
      prisma.lead.groupBy({ by: ['assignedToId'], _count: { id: true }, where }),
    ])

    const revenueAgg = await prisma.agreement.aggregate({
      _sum: { value: true },
    })

    const byStage = byStageRaw.map((r) => ({ stage: r.pipelineStage, count: r._count.id }))

    const bySalesperson = await Promise.all(
      bySalespersonRaw.map(async (r) => {
        if (!r.assignedToId) return null
        const user = await prisma.user.findUnique({
          where: { id: r.assignedToId },
          select: { id: true, name: true },
        })
        const converted = await prisma.lead.count({
          where: { ...where, assignedToId: r.assignedToId, status: 'CONVERTED' },
        })
        return { userId: r.assignedToId, name: user?.name ?? 'Unknown', leads: r._count.id, converted, revenue: 0 }
      }),
    )

    return {
      totalLeads,
      convertedLeads,
      conversionRate: totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0,
      totalRevenue: Number(revenueAgg._sum.value ?? 0),
      byStage,
      bySalesperson: bySalesperson.filter(Boolean),
    }
  },

  async getRevenueReport(params: { from?: string; to?: string }) {
    const where: any = {}
    if (params.from || params.to) {
      where.createdAt = {}
      if (params.from) where.createdAt.gte = new Date(params.from)
      if (params.to) where.createdAt.lte = new Date(params.to)
    }

    const [agreements, upcomingRenewals] = await Promise.all([
      prisma.agreement.findMany({ where, include: { school: { select: { id: true, name: true } } } }),
      prisma.agreement.findMany({
        where: {
          renewalDate: { gte: new Date(), lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) },
          status: 'ACTIVE',
        },
        include: { school: { select: { id: true, name: true } } },
        orderBy: { renewalDate: 'asc' },
      }),
    ])

    const totalRevenue = agreements.reduce((sum, a) => sum + Number(a.value), 0)

    return {
      totalRevenue,
      byMonth: [],
      byProduct: [],
      upcomingRenewals: upcomingRenewals.map((a) => ({
        schoolId: a.schoolId,
        schoolName: a.school.name,
        renewalDate: a.renewalDate?.toISOString() ?? '',
        value: Number(a.value),
      })),
    }
  },
}
