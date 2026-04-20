import { Platform } from 'react-native'
import Constants from 'expo-constants'
import { api } from './api'

/**
 * Register for Expo push notifications and sync the token with the backend.
 *
 * NOTE: Requires `expo-notifications` + `expo-device` as Expo SDK deps.
 * They aren't in package.json yet — install with:
 *   npx expo install expo-notifications expo-device
 *
 * Once installed, this module will load them lazily. We use require() + a
 * try/catch so the app doesn't crash in environments where the module is
 * not yet installed (CI, web preview, etc.).
 */

let cachedToken: string | null = null

export async function registerForPushAsync(): Promise<string | null> {
  if (cachedToken) return cachedToken
  if (Platform.OS === 'web') return null

  let Notifications: any, Device: any
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Notifications = require('expo-notifications')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Device = require('expo-device')
  } catch {
    console.warn('[push] expo-notifications / expo-device not installed — skipping registration')
    return null
  }

  if (!Device.isDevice) {
    console.warn('[push] must be on a physical device')
    return null
  }

  const existing = await Notifications.getPermissionsAsync()
  let status = existing.status
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync()
    status = req.status
  }
  if (status !== 'granted') {
    console.warn('[push] permission not granted')
    return null
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as any).easConfig?.projectId

  const tokenResult = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)
  cachedToken = tokenResult.data

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: 4,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    })
  }

  return cachedToken
}

/** Call once post-login to sync the device token with the user's server record. */
export async function syncPushTokenWithBackend() {
  try {
    const token = await registerForPushAsync()
    if (!token) return
    await api.post('/users/me/push-token', { token })
  } catch (err) {
    console.warn('[push] sync failed:', err)
  }
}

export async function clearPushTokenOnLogout() {
  cachedToken = null
  try {
    await api.delete('/users/me/push-token')
  } catch {
    // best-effort
  }
}
