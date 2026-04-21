import { prisma } from '../config/prisma'
import { pushService } from '../services/push.service'

/**
 * Format "due in X" as a timezone-agnostic relative string. We used to embed
 * `dueDate.toLocaleString()` which formats in the *server's* timezone — so a
 * user in IST whose task is due at 18:00 local saw a notification claiming it
 * was due at 12:30 (UTC server). Relative phrasing sidesteps the TZ problem
 * entirely.
 */
function formatDueIn(dueDate: Date, now: Date): string {
  const diffMs = dueDate.getTime() - now.getTime()
  if (diffMs <= 0) return 'now'
  const mins = Math.round(diffMs / 60_000)
  if (mins < 60) return `in ${mins} min`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `in ${hours}h`
  const days = Math.round(hours / 24)
  return `in ${days}d`
}

/**
 * Find every PENDING task that's due within the next 24 hours,
 * owned by a user with a registered push token, and not already notified.
 * Send Expo push notifications and mark reminderSentAt.
 */
export async function runTaskReminders() {
  const now = new Date()
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  const tasks = await prisma.task.findMany({
    where: {
      status: 'PENDING',
      dueDate: { gte: now, lte: in24h },
      reminderSentAt: null,
      assignedTo: { pushToken: { not: null } },
    },
    include: {
      assignedTo: { select: { id: true, name: true, pushToken: true } },
      lead: { select: { schoolName: true } },
      school: { select: { name: true } },
    },
  })

  if (tasks.length === 0) return { sent: 0 }

  const messages = tasks
    .map((t) => {
      const token = t.assignedTo?.pushToken
      if (!token) return null
      const subject = t.lead?.schoolName ?? t.school?.name ?? 'Task'
      return {
        to: token,
        sound: 'default' as const,
        title: `Reminder: ${t.title}`,
        body: `${subject} — due ${formatDueIn(t.dueDate, now)}`,
        data: { taskId: t.id, leadId: t.leadId, schoolId: t.schoolId },
      }
    })
    .filter((m): m is NonNullable<typeof m> => m !== null)

  await pushService.sendBatch(messages)

  await prisma.task.updateMany({
    where: { id: { in: tasks.map((t) => t.id) } },
    data: { reminderSentAt: now },
  })

  return { sent: tasks.length }
}

/**
 * Start an interval that runs the reminder sweep every 15 min.
 * Returns a stop fn for graceful shutdown/testing.
 */
export function startTaskReminderJob(intervalMs = 15 * 60 * 1000) {
  let stopped = false
  let handle: NodeJS.Timeout | null = null

  const tick = () => {
    if (stopped) return
    runTaskReminders()
      .then((r) => {
        if (r.sent > 0) console.log(`[task-reminders] sent ${r.sent} notifications`)
      })
      .catch((err) => console.error('[task-reminders] failed:', err))
      .finally(() => {
        if (!stopped) handle = setTimeout(tick, intervalMs)
      })
  }

  // Delay first tick by 30s so the server has time to fully boot.
  handle = setTimeout(tick, 30_000)

  return () => {
    stopped = true
    if (handle) clearTimeout(handle)
  }
}
