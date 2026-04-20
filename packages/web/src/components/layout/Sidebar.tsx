import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  School,
  FileText,
  FileCheck,
  CheckSquare,
  BarChart2,
  Settings,
  Kanban,
  Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/leads', icon: Kanban, label: 'Leads & Pipeline' },
  { to: '/schools', icon: School, label: 'Schools' },
  { to: '/quotations', icon: FileText, label: 'Quotations' },
  { to: '/agreements', icon: FileCheck, label: 'Agreements' },
  { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { to: '/reports', icon: BarChart2, label: 'Reports' },
  { to: '/activity', icon: Activity, label: 'Activity Log' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 w-60 border-r bg-background flex flex-col">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <School className="h-6 w-6 text-primary" />
        <span className="font-bold text-lg">LMS CRM</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}
