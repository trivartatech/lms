import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  Users,
  School,
  TrendingUp,
  CheckSquare,
  DollarSign,
  Briefcase,
  AlertCircle,
  CalendarClock,
  ArrowRight,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { DashboardStats } from '@lms/shared'

export function DashboardPage() {
  const navigate = useNavigate()

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => api.get('/dashboard/stats').then((r) => r.data),
  })

  // ── Row 1 stat cards ─────────────────────────────────────────────────────
  const statCards = [
    {
      label: 'Total Leads',
      value: stats?.totalLeads ?? 0,
      icon: Users,
      colorClass: 'text-blue-600',
      bgClass: 'bg-blue-50',
    },
    {
      label: 'New This Month',
      value: stats?.newLeadsThisMonth ?? 0,
      icon: TrendingUp,
      colorClass: 'text-green-600',
      bgClass: 'bg-green-50',
    },
    {
      label: 'Schools / Clients',
      value: stats?.totalSchools ?? 0,
      icon: School,
      colorClass: 'text-purple-600',
      bgClass: 'bg-purple-50',
    },
    {
      label: 'Total Revenue',
      value: formatCurrency(stats?.totalRevenue ?? 0),
      icon: DollarSign,
      colorClass: 'text-yellow-600',
      bgClass: 'bg-yellow-50',
      raw: true,
    },
    {
      label: 'Pending Tasks',
      value: stats?.pendingTasks ?? 0,
      icon: CheckSquare,
      colorClass: 'text-red-600',
      bgClass: 'bg-red-50',
      onClick: () => navigate('/tasks'),
    },
    {
      label: 'Open Deals',
      value: stats?.openDeals ?? 0,
      icon: Briefcase,
      colorClass: 'text-indigo-600',
      bgClass: 'bg-indigo-50',
    },
  ]

  // ── Renewal date helpers ──────────────────────────────────────────────────
  const isUrgentRenewal = (renewalDate: string) => {
    const days = (new Date(renewalDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return days < 14
  }

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's your CRM overview.</p>
      </div>

      {/* ── Row 1: Stat cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((card) => (
          <Card
            key={card.label}
            className={card.onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}
            onClick={card.onClick}
          >
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-xs text-muted-foreground leading-snug">{card.label}</p>
                <p className="text-2xl font-bold mt-1">
                  {card.raw ? card.value : (card.value as number).toLocaleString()}
                </p>
              </div>
              <div className={`${card.bgClass} p-2 rounded-lg`}>
                <card.icon className={`h-6 w-6 ${card.colorClass}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Row 2: Pipeline funnel + Today's Focus ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipeline Funnel – spans 2 cols */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Pipeline Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.pipelineByStage?.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={stats.pipelineByStage} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Leads" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-sm py-10 text-center">No pipeline data yet</p>
            )}
          </CardContent>
        </Card>

        {/* Today's Focus – spans 1 col */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-muted-foreground" />
              Today's Focus
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Due Today</p>
              <p className="text-5xl font-bold text-primary">{stats?.tasksDueToday ?? 0}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {stats?.tasksDueToday === 1 ? 'task' : 'tasks'}
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-red-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium text-red-700">Overdue</span>
              </div>
              <span className="text-lg font-bold text-red-600">{stats?.overdueTasksCount ?? 0}</span>
            </div>

            <button
              onClick={() => navigate('/tasks')}
              className="w-full flex items-center justify-center gap-2 text-sm text-primary font-medium hover:underline"
            >
              View all tasks <ArrowRight className="h-4 w-4" />
            </button>
          </CardContent>
        </Card>
      </div>

      {/* ── Row 3: Renewals + Top Referring Schools ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agreement Renewals */}
        <Card>
          <CardHeader>
            <CardTitle>Agreement Renewals (Next 60 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.upcomingRenewals?.length ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">School</th>
                    <th className="pb-2 font-medium">Renewal Date</th>
                    <th className="pb-2 font-medium text-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.upcomingRenewals.map((r) => (
                    <tr key={r.schoolId} className="border-b last:border-0">
                      <td className="py-2 font-medium">{r.schoolName}</td>
                      <td
                        className={`py-2 ${
                          isUrgentRenewal(r.renewalDate) ? 'text-red-600 font-semibold' : ''
                        }`}
                      >
                        {formatDate(r.renewalDate)}
                      </td>
                      <td className="py-2 text-right">{formatCurrency(r.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-muted-foreground text-sm py-8 text-center">No renewals due soon</p>
            )}
          </CardContent>
        </Card>

        {/* Top Referring Schools */}
        <Card>
          <CardHeader>
            <CardTitle>Top Referring Schools</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.topReferringSchools?.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.topReferringSchools} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="referrals" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-sm py-8 text-center">No referral data yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 4: Referral program KPIs ────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Referral Program</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex flex-col items-center justify-center p-5 rounded-xl bg-green-50">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                Conversion Rate
              </p>
              <p className="text-4xl font-bold text-green-600">
                {stats?.referralConversionRate ?? 0}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats?.convertedReferrals ?? 0} of {stats?.totalReferrals ?? 0} referrals
              </p>
            </div>
            <div className="flex flex-col items-center justify-center p-5 rounded-xl bg-indigo-50">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                Pending Commission
              </p>
              <p className="text-3xl font-bold text-indigo-600">
                {formatCurrency(stats?.pendingCommissionTotal ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">awaiting payout</p>
            </div>
            <div className="flex flex-col items-center justify-center p-5 rounded-xl bg-emerald-50">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                Paid Commission
              </p>
              <p className="text-3xl font-bold text-emerald-600">
                {formatCurrency(stats?.paidCommissionTotal ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">lifetime disbursed</p>
            </div>
            <div className="flex flex-col items-center justify-center p-5 rounded-xl bg-amber-50">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                Total Referrals
              </p>
              <p className="text-4xl font-bold text-amber-600">
                {stats?.totalReferrals ?? 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">leads introduced</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
