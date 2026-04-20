import { prisma } from '../config/prisma'
import { AppError } from '../middleware/error.middleware'
import { timelineService } from './timeline.service'

export const referralsService = {
  /**
   * CRITICAL: Creates a referral from a school.
   * Auto-creates a Lead linked to the referring school.
   */
  async createReferral(
    referringSchoolId: number,
    data: {
      schoolName: string
      contactPerson: string
      phone: string
      email: string
      location?: string
      totalStudents?: number
      assignedToId?: number
      notes?: string
      bonusType: string
      bonusValue: number
    },
    userId: number,
  ) {
    const school = await prisma.school.findUnique({ where: { id: referringSchoolId } })
    if (!school) throw new AppError(404, 'School not found')

    // Auto-create Lead
    const lead = await prisma.lead.create({
      data: {
        schoolName: data.schoolName,
        contactPerson: data.contactPerson,
        phone: data.phone,
        email: data.email,
        location: data.location,
        totalStudents: data.totalStudents,
        assignedToId: data.assignedToId,
        referredBySchoolId: referringSchoolId,
        referralNotes: data.notes,
        status: 'NEW',
        pipelineStage: 'NEW',
      },
    })

    // Create incentive record
    const incentive = await prisma.referralIncentive.create({
      data: {
        referringSchoolId,
        leadId: lead.id,
        bonusType: data.bonusType as any,
        bonusValue: data.bonusValue,
        payoutStatus: 'PENDING',
      },
    })

    // Log timeline on the referring school
    await timelineService.logEvent({
      schoolId: referringSchoolId,
      eventType: 'REFERRAL_CREATED',
      description: `Referred new school: ${data.schoolName}`,
      createdById: userId,
    })

    // Log timeline on the new lead
    await timelineService.logEvent({
      leadId: lead.id,
      eventType: 'LEAD_CREATED',
      description: `Lead created via referral from ${school.name}`,
      createdById: userId,
    })

    return { lead, incentive }
  },

  /**
   * Get all referrals made by a school with status, deal value, commission
   */
  async getSchoolReferrals(schoolId: number) {
    const leads = await prisma.lead.findMany({
      where: { referredBySchoolId: schoolId },
      include: {
        quotations: { orderBy: { createdAt: 'desc' }, take: 1 },
        referralIncentive: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return leads.map((lead) => ({
      leadId: lead.id,
      schoolName: lead.schoolName,
      contactPerson: lead.contactPerson,
      phone: lead.phone,
      status: lead.status,
      pipelineStage: lead.pipelineStage,
      dealValue: lead.quotations[0] ? Number(lead.quotations[0].total) : null,
      commission: lead.referralIncentive?.calculatedCommission
        ? Number(lead.referralIncentive.calculatedCommission)
        : null,
      payoutStatus: lead.referralIncentive?.payoutStatus ?? 'PENDING',
      createdAt: lead.createdAt,
      incentiveId: lead.referralIncentive?.id,
    }))
  },

  async updateIncentivePayout(incentiveId: number, payoutStatus: string) {
    const incentive = await prisma.referralIncentive.findUnique({ where: { id: incentiveId } })
    if (!incentive) throw new AppError(404, 'Incentive not found')
    return prisma.referralIncentive.update({
      where: { id: incentiveId },
      data: { payoutStatus: payoutStatus as any },
    })
  },

  async getDashboard() {
    const [total, converted, pendingCommission, paidCommission, topReferrers] = await Promise.all([
      prisma.referralIncentive.count(),
      prisma.referralIncentive.count({ where: { convertedSchoolId: { not: null } } }),
      prisma.referralIncentive.aggregate({
        where: { payoutStatus: 'PENDING', calculatedCommission: { not: null } },
        _sum: { calculatedCommission: true },
      }),
      prisma.referralIncentive.aggregate({
        where: { payoutStatus: 'PAID' },
        _sum: { calculatedCommission: true },
      }),
      prisma.referralIncentive.groupBy({
        by: ['referringSchoolId'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
    ])

    const topReferrerDetails = await Promise.all(
      topReferrers.map(async (r) => {
        const school = await prisma.school.findUnique({
          where: { id: r.referringSchoolId },
          select: { id: true, name: true },
        })
        const convertedCount = await prisma.referralIncentive.count({
          where: { referringSchoolId: r.referringSchoolId, convertedSchoolId: { not: null } },
        })
        const commission = await prisma.referralIncentive.aggregate({
          where: { referringSchoolId: r.referringSchoolId },
          _sum: { calculatedCommission: true },
        })
        return {
          schoolId: r.referringSchoolId,
          schoolName: school?.name ?? 'Unknown',
          totalReferrals: r._count.id,
          converted: convertedCount,
          conversionRate: r._count.id > 0 ? Math.round((convertedCount / r._count.id) * 100) : 0,
          totalRevenue: 0,
          totalCommission: Number(commission._sum.calculatedCommission ?? 0),
        }
      }),
    )

    return {
      totalReferrals: total,
      converted,
      conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0,
      totalCommissionPending: Number(pendingCommission._sum.calculatedCommission ?? 0),
      totalCommissionPaid: Number(paidCommission._sum.calculatedCommission ?? 0),
      topReferrers: topReferrerDetails,
    }
  },
}
