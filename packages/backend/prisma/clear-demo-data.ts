import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Clearing demo data — users, addons, and refresh tokens are preserved.')

  const result = await prisma.$transaction(async (tx) => {
    const timeline = await tx.timelineEvent.deleteMany({})
    const referralIncentives = await tx.referralIncentive.deleteMany({})
    const quotationItems = await tx.quotationItem.deleteMany({})
    const quotations = await tx.quotation.deleteMany({})
    const tasks = await tx.task.deleteMany({})
    const agreements = await tx.agreement.deleteMany({})
    const schoolAddons = await tx.schoolAddon.deleteMany({})
    const contacts = await tx.contact.deleteMany({})
    const leads = await tx.lead.deleteMany({})
    const schools = await tx.school.deleteMany({})

    return {
      schools: schools.count,
      leads: leads.count,
      contacts: contacts.count,
      quotations: quotations.count,
      quotationItems: quotationItems.count,
      agreements: agreements.count,
      tasks: tasks.count,
      schoolAddons: schoolAddons.count,
      timelineEvents: timeline.count,
      referralIncentives: referralIncentives.count,
    }
  })

  console.table(result)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
