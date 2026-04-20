import { prisma } from '../config/prisma'
import { AppError } from '../middleware/error.middleware'
import { timelineService, computeDiff } from './timeline.service'
import { Decimal } from '@prisma/client/runtime/library'

const leadInclude = {
  assignedTo: { select: { id: true, name: true, email: true, role: true } },
  referredBySchool: { select: { id: true, name: true } },
  referredByLead: { select: { id: true, schoolName: true } },
}

export const leadsService = {
  async getAll(params: {
    stage?: string
    status?: string
    assignedTo?: number
    search?: string
    userId: number
    userRole: string
    page?: number
    limit?: number
  }) {
    const { page = 1, limit = 20, userId, userRole, search, stage, status, assignedTo } = params
    const skip = (page - 1) * limit

    const where: any = {}
    if (userRole === 'SALES_EXECUTIVE') where.assignedToId = userId
    if (stage) where.pipelineStage = stage
    if (status) where.status = status
    if (assignedTo) where.assignedToId = assignedTo
    if (search) {
      where.OR = [
        { schoolName: { contains: search } },
        { contactPerson: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ]
    }

    const [data, total] = await Promise.all([
      prisma.lead.findMany({ where, include: leadInclude, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.lead.count({ where }),
    ])
    return { data, total, page, limit }
  },

  async getById(id: number) {
    const lead = await prisma.lead.findUnique({ where: { id }, include: leadInclude })
    if (!lead) throw new AppError(404, 'Lead not found')
    return lead
  },

  async create(data: any, userId: number) {
    const lead = await prisma.lead.create({ data, include: leadInclude })
    await Promise.all([
      prisma.contact.create({
        data: {
          name: lead.contactPerson,
          phone: lead.phone,
          email: lead.email ?? undefined,
          isPrimary: true,
          leadId: lead.id,
        },
      }),
      timelineService.logEvent({
        leadId: lead.id,
        eventType: 'LEAD_CREATED',
        description: `Lead created for ${lead.schoolName}`,
        createdById: userId,
      }),
    ])
    return lead
  },

  async update(id: number, data: any, userId: number) {
    const existing = await prisma.lead.findUnique({ where: { id } })
    if (!existing) throw new AppError(404, 'Lead not found')

    const lead = await prisma.lead.update({ where: { id }, data, include: leadInclude })

    // Compute field-level diff against the submitted patch so we know exactly
    // which columns changed (not just the full row).
    const diff = computeDiff(
      existing as unknown as Record<string, unknown>,
      data   as Record<string, unknown>,
    )

    if (data.pipelineStage && data.pipelineStage !== existing.pipelineStage) {
      await timelineService.logEvent({
        leadId: id,
        eventType: 'STAGE_CHANGED',
        description: `Stage changed from ${existing.pipelineStage} to ${data.pipelineStage}`,
        createdById: userId,
        diff,
      })
    } else if (Object.keys(diff).length > 0) {
      await timelineService.logEvent({
        leadId: id,
        eventType: 'LEAD_UPDATED',
        description: `Updated: ${Object.keys(diff).join(', ')}`,
        createdById: userId,
        diff,
      })
    }
    return lead
  },

  async remove(id: number) {
    const lead = await prisma.lead.findUnique({ where: { id } })
    if (!lead) throw new AppError(404, 'Lead not found')
    await prisma.lead.delete({ where: { id } })
  },

  async bulkAction(ids: number[], action: string, payload: any) {
    if (action === 'assign') {
      await prisma.lead.updateMany({ where: { id: { in: ids } }, data: { assignedToId: payload.assignedToId } })
    } else if (action === 'stage') {
      await prisma.lead.updateMany({ where: { id: { in: ids } }, data: { pipelineStage: payload.pipelineStage } })
    } else if (action === 'delete') {
      await prisma.lead.deleteMany({ where: { id: { in: ids } } })
    }
    return { affected: ids.length }
  },

  async importLeads(rows: any[], userId: number) {
    const created = []
    for (const row of rows) {
      if (!row.schoolName || !row.phone) continue
      const lead = await prisma.lead.create({
        data: {
          schoolName: row.schoolName,
          contactPerson: row.contactPerson || '',
          phone: row.phone,
          email: row.email,
          location: row.location,
          notes: row.notes,
          status: 'NEW',
          pipelineStage: 'NEW',
        },
        include: leadInclude,
      })
      created.push(lead)
    }
    return { imported: created.length }
  },

  async getAddons(leadId: number) {
    return prisma.schoolAddon.findMany({
      where: { leadId },
      include: { addon: true },
    })
  },

  async addAddon(leadId: number, data: { addonId: number; price: number; startDate: string }) {
    return prisma.schoolAddon.create({
      data: { leadId, addonId: data.addonId, price: data.price, startDate: new Date(data.startDate) },
      include: { addon: true },
    })
  },

  async removeAddon(leadId: number, addonId: number) {
    const existing = await prisma.schoolAddon.findFirst({ where: { leadId, addonId } })
    if (!existing) throw new AppError(404, 'Add-on not active for this lead')
    return prisma.schoolAddon.delete({ where: { id: existing.id } })
  },

  async createLeadReferral(
    referringLeadId: number,
    data: {
      schoolName: string; contactPerson: string; phone: string; email?: string
      location?: string; notes?: string; totalStudents?: number; assignedToId?: number
      bonusType?: string; bonusValue?: number
    },
    userId: number,
  ) {
    const referring = await prisma.lead.findUnique({ where: { id: referringLeadId } })
    if (!referring) throw new AppError(404, 'Lead not found')

    const lead = await prisma.lead.create({
      data: {
        schoolName: data.schoolName,
        contactPerson: data.contactPerson,
        phone: data.phone,
        email: data.email,
        location: data.location,
        referralNotes: data.notes,
        totalStudents: data.totalStudents,
        assignedToId: data.assignedToId,
        referredByLeadId: referringLeadId,
        status: 'NEW',
        pipelineStage: 'NEW',
      },
      include: leadInclude,
    })

    await Promise.all([
      timelineService.logEvent({
        leadId: referringLeadId,
        eventType: 'REFERRAL_CREATED',
        description: `Referred new school: ${data.schoolName}`,
        createdById: userId,
      }),
      timelineService.logEvent({
        leadId: lead.id,
        eventType: 'LEAD_CREATED',
        description: `Lead created via referral from ${referring.schoolName}`,
        createdById: userId,
      }),
    ])

    return lead
  },

  async getLeadReferrals(leadId: number) {
    const leads = await prisma.lead.findMany({
      where: { referredByLeadId: leadId },
      include: {
        quotations: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    })
    return leads.map((l) => ({
      leadId: l.id,
      schoolName: l.schoolName,
      contactPerson: l.contactPerson,
      phone: l.phone,
      status: l.status,
      pipelineStage: l.pipelineStage,
      dealValue: l.quotations[0] ? Number(l.quotations[0].total) : null,
      createdAt: l.createdAt,
    }))
  },

  async convertToSchool(leadId: number, userId: number) {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { referralIncentive: true },
    })
    if (!lead) throw new AppError(404, 'Lead not found')
    if (lead.status === 'CONVERTED') throw new AppError(400, 'Lead is already converted')

    // Create school record, preserving referral chain
    const school = await prisma.school.create({
      data: {
        name: lead.schoolName,
        contactPerson: lead.contactPerson,
        phone: lead.phone,
        email: lead.email,
        location: lead.location,
        totalStudents: lead.totalStudents,
        referredBySchoolId: lead.referredBySchoolId,
        createdFromLeadId: lead.id,
      },
    })

    // Transfer add-ons, quotations, contacts, tasks, and referred leads to the new school
    // (keep leadId intact so they still appear in the lead's history)
    await Promise.all([
      prisma.schoolAddon.updateMany({
        where: { leadId },
        data: { schoolId: school.id },
      }),
      prisma.quotation.updateMany({
        where: { leadId },
        data: { schoolId: school.id },
      }),
      prisma.contact.updateMany({
        where: { leadId },
        data: { schoolId: school.id },
      }),
      prisma.task.updateMany({
        where: { leadId },
        data: { schoolId: school.id },
      }),
      // Leads referred by this lead now show under the new school's referrals too
      prisma.lead.updateMany({
        where: { referredByLeadId: leadId },
        data: { referredBySchoolId: school.id },
      }),
    ])

    // Update lead status
    await prisma.lead.update({
      where: { id: leadId },
      data: { status: 'CONVERTED', pipelineStage: 'CLOSED_WON' },
    })

    // Update referral incentive if exists
    if (lead.referralIncentive) {
      let calculatedCommission: Decimal | null = null

      if (lead.referralIncentive.bonusType === 'FIXED') {
        calculatedCommission = lead.referralIncentive.bonusValue
      } else {
        // For PERCENTAGE: use latest agreement value if available, else null
        const latestAgreement = await prisma.agreement.findFirst({
          where: { schoolId: school.id },
          orderBy: { createdAt: 'desc' },
        })
        if (latestAgreement) {
          calculatedCommission = new Decimal(latestAgreement.value)
            .mul(lead.referralIncentive.bonusValue)
            .div(100)
        }
      }

      await prisma.referralIncentive.update({
        where: { id: lead.referralIncentive.id },
        data: { convertedSchoolId: school.id, calculatedCommission },
      })
    }

    // Timeline events
    await timelineService.logEvent({
      leadId,
      eventType: 'LEAD_CONVERTED',
      description: `Lead converted to school: ${school.name}`,
      createdById: userId,
    })
    await timelineService.logEvent({
      schoolId: school.id,
      eventType: 'LEAD_CONVERTED',
      description: `School created from lead #${leadId}`,
      createdById: userId,
    })

    return school
  },
}
