import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { exportRowsAsCSV } from '@/lib/export'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import type { SalesReport, ReferralReport } from '@lms/shared'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']

export function ReportsPage() {
  const { data: sales } = useQuery<SalesReport>({
    queryKey: ['reports', 'sales'],
    queryFn: () => api.get('/sales').then((r) => r.data),
  })

  const { data: referrals } = useQuery<ReferralReport>({
    queryKey: ['reports', 'referrals'],
    queryFn: () => api.get('/referrals').then((r) => r.data),
  })

  const stageData = sales?.byStage?.map((s) => ({
    name: s.stage.replace('_', ' '),
    count: s.count,
  })) ?? []

  const exportSalesCSV = () => {
    if (!sales) return
    exportRowsAsCSV(
      sales.bySalesperson.map((sp: any) => ({
        salesperson: sp.name,
        leads: sp.leads,
        converted: sp.converted,
        conversionRate: sp.leads ? Math.round((sp.converted / sp.leads) * 100) + '%' : '0%',
        revenue: sp.revenue,
      })),
      [
        { key: 'salesperson',    label: 'Salesperson' },
        { key: 'leads',          label: 'Leads' },
        { key: 'converted',      label: 'Converted' },
        { key: 'conversionRate', label: 'Conversion Rate' },
        { key: 'revenue',        label: 'Revenue' },
      ],
      `sales-report-${new Date().toISOString().slice(0, 10)}.csv`,
    )
  }

  const exportReferralsCSV = () => {
    if (!referrals?.topReferrers) return
    exportRowsAsCSV(
      referrals.topReferrers.map((r) => ({
        school: r.schoolName,
        referrals: r.totalReferrals,
        converted: r.converted,
        conversionRate: r.conversionRate + '%',
        revenue: r.totalRevenue,
        commission: r.totalCommission,
      })),
      [
        { key: 'school',         label: 'School' },
        { key: 'referrals',      label: 'Referrals' },
        { key: 'converted',      label: 'Converted' },
        { key: 'conversionRate', label: 'Conversion Rate' },
        { key: 'revenue',        label: 'Revenue' },
        { key: 'commission',     label: 'Commission' },
      ],
      `referrals-report-${new Date().toISOString().slice(0, 10)}.csv`,
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-muted-foreground text-sm">Sales & referral performance analytics</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportSalesCSV} disabled={!sales}>
            <Download className="h-4 w-4 mr-1" /> Export Sales CSV
          </Button>
          <Button size="sm" variant="outline" onClick={exportReferralsCSV} disabled={!referrals}>
            <Download className="h-4 w-4 mr-1" /> Export Referrals CSV
          </Button>
        </div>
      </div>

      {/* Sales KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Leads', value: sales?.totalLeads ?? 0 },
          { label: 'Converted', value: sales?.convertedLeads ?? 0 },
          { label: 'Conv. Rate', value: `${sales?.conversionRate ?? 0}%` },
          { label: 'Total Revenue', value: formatCurrency(sales?.totalRevenue ?? 0) },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold">{kpi.value}</p>
              <p className="text-sm text-muted-foreground">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline distribution */}
        <Card>
          <CardHeader><CardTitle>Leads by Pipeline Stage</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={stageData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Salesperson performance */}
        <Card>
          <CardHeader><CardTitle>Performance by Salesperson</CardTitle></CardHeader>
          <CardContent>
            {sales?.bySalesperson?.length ? (
              <div className="space-y-3">
                {sales.bySalesperson.filter(Boolean).map((sp: any) => (
                  <div key={sp.userId} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{sp.name}</span>
                    <div className="flex gap-4 text-muted-foreground">
                      <span>{sp.leads} leads</span>
                      <span className="text-green-600">{sp.converted} converted</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground text-sm">No data yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Referral KPIs */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Referral Performance</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Referrals', value: referrals?.totalReferrals ?? 0 },
            { label: 'Converted', value: referrals?.converted ?? 0 },
            { label: 'Conv. Rate', value: `${referrals?.conversionRate ?? 0}%` },
            { label: 'Commission Pending', value: formatCurrency(referrals?.totalCommissionPending ?? 0) },
          ].map((kpi) => (
            <Card key={kpi.label}>
              <CardContent className="py-4 text-center">
                <p className="text-2xl font-bold">{kpi.value}</p>
                <p className="text-sm text-muted-foreground">{kpi.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader><CardTitle>Top Referring Schools</CardTitle></CardHeader>
          <CardContent>
            {referrals?.topReferrers?.length ? (
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {['School', 'Referrals', 'Converted', 'Conv. Rate', 'Commission'].map((h) => (
                        <th key={h} className="px-4 py-2 text-left font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {referrals.topReferrers.map((r) => (
                      <tr key={r.schoolId} className="hover:bg-muted/30">
                        <td className="px-4 py-2 font-medium">{r.schoolName}</td>
                        <td className="px-4 py-2 text-muted-foreground">{r.totalReferrals}</td>
                        <td className="px-4 py-2 text-green-600">{r.converted}</td>
                        <td className="px-4 py-2 text-muted-foreground">{r.conversionRate}%</td>
                        <td className="px-4 py-2 font-medium">{formatCurrency(r.totalCommission)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground text-sm">No referral data yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
