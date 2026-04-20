import { create } from 'zustand'
import type { UserSummary } from '@lms/shared'

interface AuthState {
  accessToken: string | null
  user: UserSummary | null
  setAuth: (token: string, user: UserSummary) => void
  setAccessToken: (token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  setAuth: (accessToken, user) => set({ accessToken, user }),
  setAccessToken: (accessToken) => set({ accessToken }),
  logout: () => set({ accessToken: null, user: null }),
}))
