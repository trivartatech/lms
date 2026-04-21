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
let handlerConfigured = false
let responseSub: { remove: () => void } | null = null

function loadNotifications(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications')
  } catch {
    return null
  }
}

/**
 * Configure how notifications behave when received while the app is in the
 * foreground. Without this, iOS/Android silently swallow foreground pushes —
 * the user hears/sees nothing until they background the app.
 *
 * Safe to call multiple times; we guard with `handlerConfigured`.
 */
export function configureNotificationHandler() {
  if (handlerConfigured) return
  const Notifications = loadNotifications()
  if (!Notifications) return
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  })
  handlerConfigured = true
}

export async function registerForPushAsync(): Promise<string | null> {
  if (cachedToken) return cachedToken
  if (Platform.OS === 'web') return null

  const Notifications = loadNotifications()
  let Device: any
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Device = require('expo-device')
  } catch {
    Device = null
  }
  if (!Notifications || !Device) {
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

/**
 * Attach a tap-to-deep-link listener. When the user taps a notification, we
 * route to the most specific entity on the payload: taskId > leadId > schoolId.
 *
 * Pass an expo-router `router` instance; we call `router.push(...)`. Returns a
 * cleanup fn. Safe to call multiple times — we always remove the prior sub
 * first so you don't double-route on hot reload.
 */
export function attachNotificationTapListener(router: { push: (href: string) => void }) {
  const Notifications = loadNotifications()
  if (!Notifications) return () => {}

  if (responseSub) {
    responseSub.remove()
    responseSub = null
  }

  const handle = (response: any) => {
    const data = response?.notification?.request?.content?.data ?? {}
    if (data?.taskId) {
      router.push('/(app)/tasks')
      return
    }
    if (data?.leadId) {
      router.push(`/(app)/leads/${data.leadId}`)
      return
    }
    if (data?.schoolId) {
      router.push(`/(app)/schools/${data.schoolId}`)
    }
  }

  responseSub = Notifications.addNotificationResponseReceivedListener(handle)

  // If the app was launched cold by a notification tap, the listener above
  // fires too late — expo stashes that initial response for us to pick up.
  Notifications.getLastNotificationResponseAsync?.()
    .then((response: any) => {
      if (response) handle(response)
    })
    .catch(() => {})

  return () => {
    if (responseSub) {
      responseSub.remove()
      responseSub = null
    }
  }
}
