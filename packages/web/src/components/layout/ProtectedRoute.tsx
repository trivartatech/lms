import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()
  const { pathname } = useLocation()
  if (!user) return <Navigate to="/login" replace />
  if ((user.role === 'FINANCE' || user.role === 'SUPPORT') && !['/workspace', '/operations', '/settings'].includes(pathname)) {
    return <Navigate to={user.role === 'FINANCE' ? '/workspace?module=receipts' : '/operations?module=support'} replace />
  }
  return <>{children}</>
}
