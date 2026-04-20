import { create } from 'zustand'
import type { UserSummary } from '@lms/shared'

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: UserSummary | null
  setAuth: (accessToken: string, refreshToken: string, user: UserSummary) => void
  setAccessToken: (token: string) => void
  logout: () => void
}

// refreshToken is intentionally kept in-memory only (never written to
// AsyncStorage). The session dies when the app is closed so the user must
// log in again on next launch. Multi-device login is supported server-side.
export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  setAuth: (accessToken, refreshToken, user) => set({ accessToken, refreshToken, user }),
  setAccessToken: (accessToken) => set({ accessToken }),
  logout: () => set({ accessToken: null, refreshToken: null, user: null }),
}))
