import { prisma } from '../config/prisma'

interface LogEventParams {
  leadId?: number
  schoolId?: number
  eventType: string
  description: string
  createdById?: number
  /** Optional structured diff for UPDATE events. */
  diff?: Record<string, { before: unknown; after: unknown }>
}

/**
 * Compute a field-level diff between two shallow objects. Ignores Dates/Decimals
 * that are equal by JSON stringification. Only returns keys present in `next`.
 */
export function computeDiff(prev: Record<string, unknown>, next: Record<string, unknown>) {
  const diff: Record<string, { before: unknown; after: unknown }> = {}
  for (const key of Object.keys(next)) {
    const before = prev[key]
    const after  = next[key]
    // Normalise Decimal/Date to string for comparison
    const a = before == null ? null : (before as any).toISOString?.() ?? (before as any).toString?.() ?? before
    const b = after  == null ? null : (after  as any).toISOString?.() ?? (after  as any).toString?.() ?? after
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      diff[key] = { before: before ?? null, after: after ?? null }
    }
  }
  return diff
}

export const timelineService = {
  async logEvent(params: LogEventParams) {
    const { diff, ...rest } = params
    return prisma.timelineEvent.create({
      data: {
        ...rest,
        diff: diff && Object.keys(diff).length > 0 ? JSON.stringify(diff) : null,
      },
    })
  },

  async getLeadTimeline(leadId: number) {
    return prisma.timelineEvent.findMany({
      where: { leadId },
      include: { createdBy: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: 'desc' },
    })
  },

  async getSchoolTimeline(schoolId: number) {
    return prisma.timelineEvent.findMany({
      where: { schoolId },
      include: { createdBy: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: 'desc' },
    })
  },
}
