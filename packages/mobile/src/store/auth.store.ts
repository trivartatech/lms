import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { UserSummary } from '@lms/shared'

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: UserSummary | null
  setAuth: (accessToken: string, refreshToken: string, user: UserSummary) => void
  setAccessToken: (token: string) => void
  setTokens: (accessToken: string, refreshToken: string) => void
  logout: () => void
}

// Session is intentionally NOT persisted — the user must log in every time
// they open the app. Tokens live in memory only. Any previously persisted
// session is purged on boot by clearPersistedAuth() in app/_layout.tsx.
export const useAuthStore = create<AuthState>()((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  setAuth: (accessToken, refreshToken, user) => set({ accessToken, refreshToken, user }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
  logout: () => set({ accessToken: null, refreshToken: null, user: null }),
}))

/**
 * Wipe any legacy persisted auth state left over from builds where the
 * session was remembered across restarts. Call once on app boot.
 */
export async function clearPersistedAuth() {
  try {
    await AsyncStorage.removeItem('lms-auth')
  } catch {
    // ignore — storage may be unavailable on first run
  }
}
