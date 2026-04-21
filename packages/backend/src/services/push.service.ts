import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk'
import { env } from '../config/env'
import { prisma } from '../config/prisma'

const expo = new Expo({
  accessToken: env.EXPO_ACCESS_TOKEN || undefined,
})

export const pushService = {
  /**
   * Save an Expo push token on a user. Idempotent — replaces whatever token
   * was previously stored for that user.
   */
  async registerToken(userId: number, token: string) {
    if (!Expo.isExpoPushToken(token)) {
      throw new Error('Invalid Expo push token')
    }
    return prisma.user.update({
      where: { id: userId },
      data: { pushToken: token },
      select: { id: true, pushToken: true },
    })
  },

  /**
   * Clear a user's push token (e.g. on logout).
   */
  async clearToken(userId: number) {
    return prisma.user.update({
      where: { id: userId },
      data: { pushToken: null },
      select: { id: true },
    })
  },

  /**
   * Send a batch of push messages. Filters invalid tokens.
   *
   * Inspects returned tickets for `DeviceNotRegistered` — these are Expo's
   * signal that a token belongs to an app that was uninstalled or had
   * notifications disabled. We null out those tokens in the DB so we stop
   * shipping wasted requests on every reminder sweep.
   *
   * Returns tickets with delivery status per message.
   */
  async sendBatch(messages: ExpoPushMessage[]) {
    const valid = messages.filter((m) => {
      const to = Array.isArray(m.to) ? m.to[0] : m.to
      return to && Expo.isExpoPushToken(to)
    })
    if (valid.length === 0) return []

    const chunks = expo.chunkPushNotifications(valid)
    const tickets: ExpoPushTicket[] = []

    // Track the token each ticket corresponds to so we can prune dead ones.
    // Expo returns tickets in the same order as messages within a chunk.
    const deadTokens = new Set<string>()
    let chunkStart = 0

    for (const chunk of chunks) {
      try {
        const chunkTickets = await expo.sendPushNotificationsAsync(chunk)
        chunkTickets.forEach((ticket, i) => {
          tickets.push(ticket)
          if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
            const msg = valid[chunkStart + i]
            const to = Array.isArray(msg.to) ? msg.to[0] : msg.to
            if (to) deadTokens.add(to)
          }
        })
      } catch (err) {
        console.error('[push] chunk send failed:', err)
      }
      chunkStart += chunk.length
    }

    if (deadTokens.size > 0) {
      try {
        const result = await prisma.user.updateMany({
          where: { pushToken: { in: Array.from(deadTokens) } },
          data: { pushToken: null },
        })
        console.log(`[push] cleared ${result.count} DeviceNotRegistered token(s)`)
      } catch (err) {
        console.error('[push] failed to clear dead tokens:', err)
      }
    }

    return tickets
  },
}
