import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserSummary } from '@lms/shared'

interface AuthState {
  accessToken: string | null
  user: UserSummary | null
  setAuth: (token: string, user: UserSummary) => void
  setAccessToken: (token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      setAuth: (accessToken, user) => set({ accessToken, user }),
      setAccessToken: (accessToken) => set({ accessToken }),
      logout: () => set({ accessToken: null, user: null }),
    }),
    {
      name: 'lms-auth',
      partialize: (state) => ({ user: state.user }),
    },
  ),
)
