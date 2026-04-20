import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // ─── Users ────────────────────────────────────────────────────────────────
  const exec1 = await prisma.user.upsert({
    where: { email: 'exec@lms.com' },
    update: {},
    create: { name: 'Rahul Sharma', email: 'exec@lms.com', passwordHash: await bcrypt.hash('exec123', 12), role: 'SALES_EXECUTIVE' },
  })
  const exec2 = await prisma.user.upsert({
    where: { email: 'exec2@lms.com' },
    update: {},
    create: { name: 'Sneha Patel', email: 'exec2@lms.com', passwordHash: await bcrypt.hash('exec123', 12), role: 'SALES_EXECUTIVE' },
  })
  await prisma.user.upsert({
    where: { email: 'manager@lms.com' },
    update: {},
    create: { name: 'Priya Mehta', email: 'manager@lms.com', passwordHash: await bcrypt.hash('manager123', 12), role: 'SALES_MANAGER' },
  })
  await prisma.user.upsert({
    where: { email: 'admin@lms.com' },
    update: {},
    create: { name: 'Admin User', email: 'admin@lms.com', passwordHash: await bcrypt.hash('admin123', 12), role: 'ADMIN' },
  })

  // ─── ERP Products (update category on existing addons 1-3) ───────────────
  const erpProducts = [
    { id: 1, name: 'School ERP Basic', description: 'Core ERP: admissions, fees, attendance, academics', price: 75000, category: 'ERP' },
    { id: 2, name: 'School ERP Pro', description: 'Full-suite ERP with HR, payroll and analytics', price: 150000, category: 'ERP' },
    { id: 3, name: 'School ERP Enterprise', description: 'Multi-campus ERP with custom integrations', price: 300000, category: 'ERP' },
  ]
  for (const p of erpProducts) {
    await prisma.addon.upsert({ where: { id: p.id }, update: p, create: p })
  }

  // ─── Add-On Services ─────────────────────────────────────────────────────
  const addonServices = [
    { id: 4, name: 'SMS Alerts', description: 'Automated SMS notifications for parents and staff', price: 5000, category: 'ADDON' },
    { id: 5, name: 'Mobile App', description: 'Custom-branded mobile app for students and parents', price: 15000, category: 'ADDON' },
    { id: 6, name: 'Biometric Integration', description: 'Biometric attendance tracking integration', price: 10000, category: 'ADDON' },
    { id: 7, name: 'Transport Management', description: 'Fleet and route management module', price: 8000, category: 'ADDON' },
    { id: 8, name: 'Library Management', description: 'Digital library catalog and circulation', price: 6000, category: 'ADDON' },
    { id: 9, name: 'Online Exam Portal', description: 'Secure online examination and result portal', price: 12000, category: 'ADDON' },
  ]
  for (const a of addonServices) {
    await prisma.addon.upsert({ where: { id: a.id }, update: a, create: a })
  }

  // ─── Client Schools ───────────────────────────────────────────────────────
  const school1 = await prisma.school.upsert({
    where: { id: 1 },
    update: { totalStudents: 1200 },
    create: {
      name: 'Greenwood International School',
      contactPerson: 'Principal Anita Sharma',
      phone: '9876543210',
      email: 'principal@greenwood.edu',
      location: 'Mumbai, Maharashtra',
      totalStudents: 1200,
    },
  })
  // School 2 may already exist as a converted school — just update totalStudents
  await prisma.school.upsert({
    where: { id: 2 },
    update: { totalStudents: 850 },
    create: {
      name: "St. Mary's Convent School",
      contactPerson: 'Sister Margaret',
      phone: '9234567890',
      email: 'admin@stmarys.edu',
      location: 'Pune, Maharashtra',
      totalStudents: 850,
      referredBySchoolId: school1.id,
    },
  })

  // ─── Agreements ───────────────────────────────────────────────────────────
  await prisma.agreement.upsert({
    where: { id: 1 },
    update: {},
    create: {
      schoolId: 1,
      startDate: new Date('2024-04-01'),
      endDate: new Date('2025-03-31'),
      renewalDate: new Date('2025-02-15'),
      status: 'ACTIVE',
      value: 165000,
      notes: 'ERP Pro + SMS Alerts + Mobile App bundle',
    },
  })
  await prisma.agreement.upsert({
    where: { id: 2 },
    update: {},
    create: {
      schoolId: 2,
      startDate: new Date('2024-07-01'),
      endDate: new Date('2025-06-30'),
      status: 'ACTIVE',
      value: 85000,
      notes: 'ERP Basic + Biometric Integration',
    },
  })

  // ─── School Add-Ons ──────────────────────────────────────────────────────
  await prisma.schoolAddon.upsert({
    where: { id: 1 },
    update: {},
    create: { schoolId: 1, addonId: 2, price: 150000, startDate: new Date('2024-04-01') }, // ERP Pro
  })
  await prisma.schoolAddon.upsert({
    where: { id: 2 },
    update: {},
    create: { schoolId: 1, addonId: 4, price: 5000, startDate: new Date('2024-04-01') },   // SMS
  })
  await prisma.schoolAddon.upsert({
    where: { id: 3 },
    update: {},
    create: { schoolId: 1, addonId: 5, price: 15000, startDate: new Date('2024-04-01') },  // Mobile App
  })
  await prisma.schoolAddon.upsert({
    where: { id: 4 },
    update: {},
    create: { schoolId: 2, addonId: 1, price: 75000, startDate: new Date('2024-07-01') },  // ERP Basic
  })
  await prisma.schoolAddon.upsert({
    where: { id: 5 },
    update: {},
    create: { schoolId: 2, addonId: 6, price: 10000, startDate: new Date('2024-07-01') },  // Biometric
  })

  // ─── Leads (keep id 1 & 2 intact if already converted) ───────────────────
  // Lead 1 — keep as-is if exists
  await prisma.lead.upsert({
    where: { id: 1 },
    update: {},
    create: {
      schoolName: 'Sunrise Academy',
      contactPerson: 'Mr. Rajesh Kumar',
      phone: '9123456789',
      email: 'rajesh@sunrise.edu',
      location: 'Delhi',
      status: 'NEW',
      pipelineStage: 'QUALIFIED',
      assignedToId: exec1.id,
    },
  })
  // Lead 2 — may be converted (St. Mary's), preserve
  await prisma.lead.upsert({
    where: { id: 2 },
    update: {},
    create: {
      schoolName: "St. Mary's Convent School",
      contactPerson: 'Sister Margaret',
      phone: '9234567890',
      email: 'admin@stmarys.edu',
      location: 'Pune, Maharashtra',
      status: 'CONVERTED',
      pipelineStage: 'CLOSED_WON',
      assignedToId: exec1.id,
      referredBySchoolId: school1.id,
      referralNotes: 'Referred by Greenwood International',
    },
  })

  // New pipeline leads
  const lead3 = await prisma.lead.upsert({
    where: { id: 3 },
    update: {},
    create: {
      schoolName: 'Bright Future School',
      contactPerson: 'Dr. Kavitha Nair',
      phone: '9345678901',
      email: 'kavitha@brightfuture.edu',
      location: 'Bangalore, Karnataka',
      status: 'IN_PROGRESS',
      pipelineStage: 'DEMO',
      assignedToId: exec1.id,
      referredBySchoolId: school1.id,
      referralNotes: 'Referred by Greenwood',
    },
  })
  const lead4 = await prisma.lead.upsert({
    where: { id: 4 },
    update: {},
    create: {
      schoolName: 'Vidya Niketan School',
      contactPerson: 'Mr. Suresh Reddy',
      phone: '9456789012',
      location: 'Hyderabad, Telangana',
      status: 'IN_PROGRESS',
      pipelineStage: 'PROPOSAL',
      assignedToId: exec2.id,
    },
  })
  await prisma.lead.upsert({
    where: { id: 5 },
    update: {},
    create: {
      schoolName: 'Delhi Public School (Noida)',
      contactPerson: 'Mrs. Renu Kapoor',
      phone: '9567890123',
      email: 'renu@dps-noida.edu',
      location: 'Noida, UP',
      status: 'IN_PROGRESS',
      pipelineStage: 'NEGOTIATION',
      assignedToId: exec2.id,
    },
  })
  await prisma.lead.upsert({
    where: { id: 6 },
    update: {},
    create: {
      schoolName: 'Rainbow Kids School',
      contactPerson: 'Mrs. Deepa Singh',
      phone: '9789012345',
      location: 'Bangalore, Karnataka',
      status: 'NEW',
      pipelineStage: 'QUALIFIED',
      assignedToId: exec2.id,
      referredByLeadId: lead3.id,
      referralNotes: 'Referred by Bright Future School (pipeline lead)',
    },
  })
  await prisma.lead.upsert({
    where: { id: 7 },
    update: {},
    create: {
      schoolName: 'Modern High School',
      contactPerson: 'Mr. Anil Verma',
      phone: '9678901234',
      location: 'Jaipur, Rajasthan',
      status: 'NEW',
      pipelineStage: 'NEW',
      assignedToId: exec1.id,
    },
  })

  // ─── Referral incentive for lead 3 ───────────────────────────────────────
  await prisma.referralIncentive.upsert({
    where: { leadId: lead3.id },
    update: {},
    create: {
      referringSchoolId: school1.id,
      leadId: lead3.id,
      bonusType: 'PERCENTAGE',
      bonusValue: 5,
      payoutStatus: 'PENDING',
    },
  })

  // ─── Tasks ────────────────────────────────────────────────────────────────
  const tomorrow = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000)
  const in2Days = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
  const in3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
  const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  await prisma.task.upsert({
    where: { id: 1 },
    update: {},
    create: {
      title: 'Follow-up call with Rajesh Kumar',
      type: 'CALL',
      dueDate: in2Days,
      status: 'PENDING',
      assignedToId: exec1.id,
      leadId: 1,
    },
  })
  await prisma.task.upsert({
    where: { id: 2 },
    update: {},
    create: {
      title: 'ERP demo for Bright Future School',
      type: 'MEETING',
      dueDate: tomorrow,
      status: 'PENDING',
      assignedToId: exec1.id,
      leadId: lead3.id,
    },
  })
  await prisma.task.upsert({
    where: { id: 3 },
    update: {},
    create: {
      title: 'Send proposal to Vidya Niketan',
      type: 'REMINDER',
      dueDate: in3Days,
      status: 'PENDING',
      assignedToId: exec2.id,
      leadId: lead4.id,
    },
  })
  await prisma.task.upsert({
    where: { id: 4 },
    update: {},
    create: {
      title: 'Greenwood — agreement renewal reminder',
      type: 'REMINDER',
      dueDate: in7Days,
      status: 'PENDING',
      assignedToId: exec1.id,
      schoolId: 1,
    },
  })

  console.log('\nSeed complete!')
  console.log('─────────────────────────────────────────────')
  console.log('Login credentials:')
  console.log('  Admin:    admin@lms.com   / admin123')
  console.log('  Manager:  manager@lms.com / manager123')
  console.log('  Exec 1:   exec@lms.com    / exec123')
  console.log('  Exec 2:   exec2@lms.com   / exec123')
  console.log('─────────────────────────────────────────────')
  console.log('ERP Products: 3 (Basic / Pro / Enterprise)')
  console.log('Add-On Services: 6')
  console.log('Schools: 2  |  Leads: 7  |  Tasks: 4  |  Agreements: 2')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
