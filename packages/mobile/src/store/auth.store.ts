import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
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

// Session IS persisted across app restarts — refreshToken + user are stored
// in AsyncStorage so the user stays signed in after closing/reopening the app,
// same as WhatsApp/Gmail. Access tokens are short-lived (15m) and refreshed
// silently via /auth/refresh on boot or on 401 responses.
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setAuth: (accessToken, refreshToken, user) => set({ accessToken, refreshToken, user }),
      setAccessToken: (accessToken) => set({ accessToken }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      logout: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    {
      name: 'lms-auth',
      storage: createJSONStorage(() => AsyncStorage),
      // Persist only the refresh token and user profile — access token is
      // always re-derived via /auth/refresh on boot, so there's no point
      // writing it to disk.
      partialize: (state) => ({
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    },
  ),
)
