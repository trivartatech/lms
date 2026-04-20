import { useState, useEffect, useRef } from 'react'
import { LogOut, User, Search, Moon, Sun, Bell } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { GlobalSearch } from '@/components/GlobalSearch'
import type { DashboardStats } from '@lms/shared'

export function Header() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [searchOpen, setSearchOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const [dark, setDark] = useState(() => {
    return localStorage.getItem('theme') === 'dark' ||
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
  })

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/dashboard/stats').then((r) => r.data),
    refetchInterval: 60_000,
  })

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [dark])

  // Register the Ctrl+K / Cmd+K shortcut globally
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Close notifications on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = async () => {
    await api.post('/auth/logout').catch(() => {})
    logout()
    navigate('/login')
  }

  const overdueCount = stats?.overdueTasksCount ?? 0
  const todayCount = stats?.tasksDueToday ?? 0
  const renewals = stats?.upcomingRenewals ?? []
  const badgeCount = overdueCount + todayCount

  return (
    <>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <header className="fixed top-0 left-60 right-0 z-30 flex h-16 items-center justify-between border-b bg-background px-6">
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search...</span>
          <kbd className="ml-2 hidden sm:inline-flex items-center gap-0.5 rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            <span>⌘</span>K
          </kbd>
        </button>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{user?.name}</span>
            <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
              {user?.role?.replace('_', ' ')}
            </span>
          </div>

          {/* Notifications bell */}
          <div className="relative" ref={notifRef}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setNotifOpen((o) => !o)}
              title="Notifications"
              className="relative"
            >
              <Bell className="h-4 w-4" />
              {badgeCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-[10px] text-destructive-foreground flex items-center justify-center font-bold leading-none">
                  {badgeCount > 9 ? '9+' : badgeCount}
                </span>
              )}
            </Button>
            {notifOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border bg-background shadow-lg z-50">
                <div className="p-3 border-b flex items-center justify-between">
                  <p className="font-semibold text-sm">Notifications</p>
                  {badgeCount > 0 && (
                    <span className="text-xs text-muted-foreground">{badgeCount} pending</span>
                  )}
                </div>
                <div className="divide-y max-h-80 overflow-y-auto">
                  {overdueCount > 0 && (
                    <Link
                      to="/tasks"
                      onClick={() => setNotifOpen(false)}
                      className="flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors"
                    >
                      <span className="mt-1.5 h-2 w-2 rounded-full bg-destructive flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-destructive">
                          {overdueCount} overdue task{overdueCount !== 1 ? 's' : ''}
                        </p>
                        <p className="text-xs text-muted-foreground">Past due date — needs attention</p>
                      </div>
                    </Link>
                  )}
                  {todayCount > 0 && (
                    <Link
                      to="/tasks"
                      onClick={() => setNotifOpen(false)}
                      className="flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors"
                    >
                      <span className="mt-1.5 h-2 w-2 rounded-full bg-amber-500 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium">
                          {todayCount} task{todayCount !== 1 ? 's' : ''} due today
                        </p>
                        <p className="text-xs text-muted-foreground">Check your task list</p>
                      </div>
                    </Link>
                  )}
                  {renewals.slice(0, 3).map((r, i) => (
                    <Link
                      key={i}
                      to={`/schools/${r.schoolId}`}
                      onClick={() => setNotifOpen(false)}
                      className="flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors"
                    >
                      <span className="mt-1.5 h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Renewal: {r.schoolName}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(r.renewalDate).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                    </Link>
                  ))}
                  {badgeCount === 0 && renewals.length === 0 && (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      All caught up!
                    </div>
                  )}
                </div>
                <div className="p-2 border-t">
                  <Link
                    to="/activity"
                    onClick={() => setNotifOpen(false)}
                    className="block text-center text-xs text-primary hover:underline py-1"
                  >
                    View all activity
                  </Link>
                </div>
              </div>
            )}
          </div>

          <Button variant="ghost" size="icon" onClick={() => setDark(!dark)} title="Toggle dark mode">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>
    </>
  )
}
