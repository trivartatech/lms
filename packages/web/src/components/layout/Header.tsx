import { useState, useEffect } from 'react'
import { LogOut, User, Search, Moon, Sun, Bell } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { GlobalSearch } from '@/components/GlobalSearch'
import type { WorkspacePage } from '@lms/shared'

export function Header() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [searchOpen, setSearchOpen] = useState(false)
  const canSearch = user?.role !== 'FINANCE' && user?.role !== 'SUPPORT'
  const [dark, setDark] = useState(() => {
    return localStorage.getItem('theme') === 'dark' ||
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
  })

  const { data: inbox } = useQuery<WorkspacePage>({
    queryKey: ['workspace', 'inbox', '', '', ''],
    queryFn: () => api.get('/workspace/inbox').then((r) => r.data),
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

  useEffect(() => {
    if (!canSearch) return
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [canSearch])

  const handleLogout = async () => {
    await api.post('/auth/logout').catch(() => {})
    logout()
    navigate('/login')
  }

  const badgeCount = inbox?.sections.find(section => section.title === 'Unread')?.cards.length ?? 0

  return (
    <>
      {canSearch && <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />}
      <header className="fixed top-0 left-60 right-0 z-30 flex h-16 items-center justify-between border-b bg-background px-6">
        {canSearch ? <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search...</span>
          <kbd className="ml-2 hidden sm:inline-flex items-center gap-0.5 rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            <span>⌘</span>K
          </kbd>
        </button> : <span />}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{user?.name}</span>
            <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
              {user?.role?.replace('_', ' ')}
            </span>
          </div>

          <Link to="/workspace?module=inbox" aria-label="Notification inbox" className="relative rounded-md p-2 hover:bg-accent">
            <Bell className="h-4 w-4" />
            {badgeCount > 0 && <span className="absolute -top-1 -right-1 rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">{badgeCount > 9 ? '9+' : badgeCount}</span>}
          </Link>

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
