import axios from 'axios'
import Constants from 'expo-constants'
import { useAuthStore } from '../store/auth.store'
import { uuidv4 } from './uuid'

const BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl ?? 'http://localhost:3001/api'

export const api = axios.create({ baseURL: BASE_URL })

const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete'])

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  // Auto-attach Idempotency-Key on mutating requests so that a queued mutation
  // replayed after a flaky network is deduplicated server-side. We only set
  // the header once per request config — `useOfflineMutation` generates a
  // stable key in `onMutate` and passes it through headers so the same key
  // survives pause + resume across app restarts.
  const method = (config.method ?? '').toLowerCase()
  if (MUTATING_METHODS.has(method)) {
    const existing =
      config.headers['Idempotency-Key'] ??
      config.headers['idempotency-key']
    if (!existing) {
      config.headers['Idempotency-Key'] = uuidv4()
    }
  }

  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const refreshToken = useAuthStore.getState().refreshToken
        if (!refreshToken) throw new Error('No refresh token')
        // Mobile passes refresh token in the body (no cookie jar in RN).
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken })
        useAuthStore.getState().setTokens(data.accessToken, data.refreshToken ?? refreshToken)
        original.headers.Authorization = `Bearer ${data.accessToken}`
        return api(original)
      } catch {
        useAuthStore.getState().logout()
      }
    }
    return Promise.reject(error)
  },
)
