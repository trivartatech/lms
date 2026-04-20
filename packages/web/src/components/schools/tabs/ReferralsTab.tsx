import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, GitBranch, ExternalLink, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AddReferralDialog } from '../AddReferralDialog'
import type { ReferralListItem } from '@lms/shared'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Props {
  schoolId: number
  schoolName: string
}

const statusVariant: Record<string, any> = {
  NEW: 'info', IN_PROGRESS: 'warning', CONVERTED: 'success', LOST: 'destructive',
}

export function ReferralsTab({ schoolId, schoolName }: Props) {
  const queryClient = useQueryClient()
  const [showDialog, setShowDialog] = useState(false)

  const { data: referrals, isLoading } = useQuery<ReferralListItem[]>({
    queryKey: ['schools', schoolId, 'referrals'],
    queryFn: () => api.get(`/schools/${schoolId}/referrals`).then((r) => r.data),
  })

  const markPaidMutation = useMutation({
    mutationFn: (incentiveId: number) =>
      api.put(`/referral-incentives/${incentiveId}`, { payoutStatus: 'PAID' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools', schoolId, 'referrals'] })
    },
  })

  const stats = {
    total: referrals?.length ?? 0,
    converted: referrals?.filter((r) => r.status === 'CONVERTED').length ?? 0,
    totalCommission: referrals?.reduce((sum, r) => sum + (r.commission ?? 0), 0) ?? 0,
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Referred Schools / Leads</h3>
          <p className="text-sm text-muted-foreground">
            {stats.total} referrals · {stats.converted} converted ·{' '}
            {formatCurrency(stats.totalCommission)} commission
          </p>
        </div>
        <Button onClick={() => setShowDialog(true)} size="sm" className="bg-purple-600 hover:bg-purple-700">
          <Plus className="h-4 w-4 mr-1" />
          Add Referral
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading referrals...</div>
      ) : referrals?.length ? (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {['School Name', 'Contact', 'Status', 'Pipeline Stage', 'Deal Value', 'Commission', 'Payout', 'Date'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {referrals.map((ref) => (
                <tr key={ref.leadId} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      to={`/leads/${ref.leadId}`}
                      className="font-medium text-primary hover:underline flex items-center gap-1"
                    >
                      {ref.schoolName}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{ref.contactPerson}</td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant[ref.status]}>
                      {ref.status.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {ref.pipelineStage.replace('_', ' ')}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {ref.dealValue ? formatCurrency(ref.dealValue) : '-'}
                  </td>
                  <td className="px-4 py-3 font-medium text-green-700">
                    {ref.commission ? formatCurrency(ref.commission) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    {ref.payoutStatus === 'PAID' ? (
                      <Badge variant="success">PAID</Badge>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge variant="warning">{ref.payoutStatus}</Badge>
                        {ref.incentiveId != null && (
                          <Button
                            size="sm"
                            className="h-6 px-2 text-xs bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => markPaidMutation.mutate(ref.incentiveId!)}
                            disabled={markPaidMutation.isPending}
                          >
                            {markPaidMutation.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              'Mark Paid'
                            )}
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {formatDate(ref.createdAt.toString())}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 border rounded-md bg-muted/20">
          <GitBranch className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">No referrals yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            {schoolName} hasn't referred any schools yet.
          </p>
          <Button
            onClick={() => setShowDialog(true)}
            className="mt-4 bg-purple-600 hover:bg-purple-700"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-1" /> Add First Referral
          </Button>
        </div>
      )}

      <AddReferralDialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['schools', schoolId, 'referrals'] })
          queryClient.invalidateQueries({ queryKey: ['leads'] })
          setShowDialog(false)
        }}
        schoolId={schoolId}
        schoolName={schoolName}
      />
    </div>
  )
}
