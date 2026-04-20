import { Expo, ExpoPushMessage } from 'expo-server-sdk'
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
   * Returns tickets with delivery status per message.
   */
  async sendBatch(messages: ExpoPushMessage[]) {
    const valid = messages.filter((m) => {
      const to = Array.isArray(m.to) ? m.to[0] : m.to
      return to && Expo.isExpoPushToken(to)
    })
    if (valid.length === 0) return []

    const chunks = expo.chunkPushNotifications(valid)
    const tickets = []
    for (const chunk of chunks) {
      try {
        const chunkTickets = await expo.sendPushNotificationsAsync(chunk)
        tickets.push(...chunkTickets)
      } catch (err) {
        console.error('[push] chunk send failed:', err)
      }
    }
    return tickets
  },
}
