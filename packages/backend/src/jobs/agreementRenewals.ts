import { prisma } from '../config/prisma'

export function renewalMilestone(date: Date, now: Date): 30 | 15 | 7 | null {
  const days = Math.ceil((date.getTime() - now.getTime()) / 86400000)
  if (days < 0 || days > 30) return null
  return days > 15 ? 30 : days > 7 ? 15 : 7
}

// Creates ordinary tasks: visible on web/mobile and delivered by the existing push job.
export async function runAgreementRenewals(now = new Date()) {
  const agreements = await prisma.agreement.findMany({ where: { status: { in: ['ACTIVE', 'PENDING_RENEWAL'] } }, include: { school: true } })
  const fallback = await prisma.user.findFirst({ where: { role: 'ADMIN' }, orderBy: { id: 'asc' } })
  let created = 0
  for (const agreement of agreements) {
    const renewalDate = agreement.renewalDate ?? agreement.endDate
    const daysBefore = renewalMilestone(renewalDate, now)
    if (daysBefore === null) continue
    try {
      await prisma.$transaction(async tx => {
        const key = { agreementId: agreement.id, renewalDate, daysBefore }
        if (await tx.agreementRenewalReminder.findUnique({ where: { agreementId_renewalDate_daysBefore: key } })) return
        const task = await tx.task.create({ data: {
          title: `Renew agreement #${agreement.id}: ${agreement.school.name} (renewal within ${daysBefore} days)`,
          type: 'REMINDER', dueDate: new Date(now.getTime() + 3600000), schoolId: agreement.schoolId,
          assignedToId: agreement.school.assignedToId ?? fallback?.id,
          notes: `Renewal date: ${renewalDate.toISOString().slice(0, 10)}. Contact the school to arrange renewal.`,
        } })
        await tx.agreementRenewalReminder.create({ data: { ...key, taskId: task.id } })
        created++
      })
    } catch (error: any) {
      if (error.code !== 'P2002') throw error
    }
  }
  return { created }
}
