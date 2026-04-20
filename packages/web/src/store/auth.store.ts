import { create } from 'zustand'
import type { UserSummary } from '@lms/shared'

interface AuthState {
  accessToken: string | null
  user: UserSummary | null
  setAuth: (token: string, user: UserSummary) => void
  setAccessToken: (token: string) => void
  logout: () => void
}

// In-memory only — state is intentionally lost on page refresh so the user
// must re-authenticate. Multi-device login is supported server-side (see
// auth.service.ts#login — new refresh tokens are issued without revoking
// existing ones for the same user).
export const useAuthStore = create<AuthState>()((set) => ({
  accessToken: null,
  user: null,
  setAuth: (accessToken, user) => set({ accessToken, user }),
  setAccessToken: (accessToken) => set({ accessToken }),
  logout: () => set({ accessToken: null, user: null }),
}))
