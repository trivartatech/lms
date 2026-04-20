import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock prisma + timeline service before importing the service under test.
vi.mock('../config/prisma', () => ({
  prisma: {
    school: { findUnique: vi.fn() },
    lead:   { create: vi.fn() },
    referralIncentive: { create: vi.fn() },
  },
}))

vi.mock('../services/timeline.service', () => ({
  timelineService: { logEvent: vi.fn().mockResolvedValue(undefined) },
  computeDiff: vi.fn(() => ({})),
}))

import { prisma } from '../config/prisma'
import { timelineService } from '../services/timeline.service'
import { referralsService } from '../services/referrals.service'

const mocked = prisma as unknown as {
  school: { findUnique: ReturnType<typeof vi.fn> }
  lead:   { create:     ReturnType<typeof vi.fn> }
  referralIncentive: { create: ReturnType<typeof vi.fn> }
}

describe('referralsService.createReferral', () => {
  beforeEach(() => {
    mocked.school.findUnique.mockReset()
    mocked.lead.create.mockReset()
    mocked.referralIncentive.create.mockReset()
    ;(timelineService.logEvent as any).mockClear()
  })

  it('throws 404 when referring school is missing', async () => {
    mocked.school.findUnique.mockResolvedValueOnce(null)
    await expect(
      referralsService.createReferral(99, {
        schoolName: 'New Acad', contactPerson: 'P', phone: '9', email: 'a@b.c',
        bonusType: 'FIXED', bonusValue: 5000,
      }, 1),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('creates a Lead with referredBySchoolId set + PENDING incentive + timeline events', async () => {
    mocked.school.findUnique.mockResolvedValueOnce({ id: 7, name: 'Origin School' })
    mocked.lead.create.mockResolvedValueOnce({ id: 101, schoolName: 'New Acad' })
    mocked.referralIncentive.create.mockResolvedValueOnce({ id: 202 })

    const result = await referralsService.createReferral(
      7,
      {
        schoolName:    'New Acad',
        contactPerson: 'Priya',
        phone:         '919000000000',
        email:         'p@new-acad.in',
        location:      'Pune',
        notes:         'met at expo',
        bonusType:     'PERCENTAGE',
        bonusValue:    10,
      },
      42,
    )

    // Lead created with referral link + NEW status
    expect(mocked.lead.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        schoolName:         'New Acad',
        referredBySchoolId: 7,
        referralNotes:      'met at expo',
        status:             'NEW',
        pipelineStage:      'NEW',
      }),
    })

    // Incentive created referencing the new lead + PENDING payout
    expect(mocked.referralIncentive.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        referringSchoolId: 7,
        leadId:            101,
        bonusType:         'PERCENTAGE',
        bonusValue:        10,
        payoutStatus:      'PENDING',
      }),
    })

    // Two timeline events (one on referring school, one on new lead)
    expect(timelineService.logEvent).toHaveBeenCalledTimes(2)
    expect(timelineService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ schoolId: 7, eventType: 'REFERRAL_CREATED' }),
    )
    expect(timelineService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ leadId: 101, eventType: 'LEAD_CREATED' }),
    )

    expect(result).toEqual({
      lead:      { id: 101, schoolName: 'New Acad' },
      incentive: { id: 202 },
    })
  })
})
