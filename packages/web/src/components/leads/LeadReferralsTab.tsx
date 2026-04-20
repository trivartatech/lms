import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { GitBranch, ExternalLink, Plus } from 'lucide-react'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { User } from '@lms/shared'

interface LeadReferral {
  leadId: number
  schoolName: string
  contactPerson: string
  phone: string
  status: string
  pipelineStage: string
  dealValue: number | null
  createdAt: string
}

const statusVariant: Record<string, any> = {
  NEW: 'info', IN_PROGRESS: 'warning', CONVERTED: 'success', LOST: 'destructive',
}

const schema = z.object({
  schoolName: z.string().min(1, 'Required'),
  contactPerson: z.string().min(1, 'Required'),
  phone: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  location: z.string().optional(),
  totalStudents: z.coerce.number().int().positive().optional().or(z.literal('')),
  assignedToId: z.string().optional(),
  notes: z.string().optional(),
  bonusType: z.enum(['FIXED', 'PERCENTAGE']),
  bonusValue: z.coerce.number().min(0),
})
type FormData = z.infer<typeof schema>

interface Props {
  leadId: number
  leadName: string
}

export function LeadReferralsTab({ leadId, leadName }: Props) {
  const queryClient = useQueryClient()
  const [showDialog, setShowDialog] = useState(false)

  const { data: referrals, isLoading } = useQuery<LeadReferral[]>({
    queryKey: ['leads', leadId, 'referrals'],
    queryFn: () => api.get(`/leads/${leadId}/referrals`).then((r) => r.data),
  })

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
    enabled: showDialog,
  })

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { bonusType: 'FIXED', bonusValue: 0 },
  })

  const bonusType = watch('bonusType')

  const onSubmit = async (data: FormData) => {
    await api.post(`/leads/${leadId}/referrals`, {
      ...data,
      totalStudents: data.totalStudents ? Number(data.totalStudents) : undefined,
      assignedToId: data.assignedToId && data.assignedToId !== 'none' ? parseInt(data.assignedToId) : undefined,
    })
    reset()
    setShowDialog(false)
    queryClient.invalidateQueries({ queryKey: ['leads', leadId, 'referrals'] })
    queryClient.invalidateQueries({ queryKey: ['leads'] })
  }

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">Loading referrals...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {referrals?.length ?? 0} lead{referrals?.length !== 1 ? 's' : ''} referred by {leadName}
        </p>
        <Button onClick={() => setShowDialog(true)} size="sm" className="bg-purple-600 hover:bg-purple-700">
          <Plus className="h-4 w-4 mr-1" /> Add Referral
        </Button>
      </div>

      {!referrals?.length ? (
        <div className="text-center py-12 border rounded-md bg-muted/20">
          <GitBranch className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">No referrals yet</p>
          <p className="text-sm text-muted-foreground mt-1">{leadName} hasn't referred any leads yet.</p>
          <Button onClick={() => setShowDialog(true)} className="mt-4 bg-purple-600 hover:bg-purple-700" size="sm">
            <Plus className="h-4 w-4 mr-1" /> Add First Referral
          </Button>
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {['School Name', 'Contact', 'Status', 'Pipeline Stage', 'Deal Value', 'Date'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {referrals.map((ref) => (
                <tr key={ref.leadId} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/leads/${ref.leadId}`} className="font-medium text-primary hover:underline flex items-center gap-1">
                      {ref.schoolName} <ExternalLink className="h-3 w-3" />
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{ref.contactPerson}</td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant[ref.status]}>{ref.status.replace('_', ' ')}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{ref.pipelineStage.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-muted-foreground">{ref.dealValue ? formatCurrency(ref.dealValue) : '-'}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(ref.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={(v) => !v && setShowDialog(false)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-purple-600" /> Add Referral from {leadName}
            </DialogTitle>
            <DialogDescription>
              Fill in the details of the new school. A lead will be automatically created and linked to {leadName}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>New School Name *</Label>
                <Input {...register('schoolName')} placeholder="Referred school name" />
                {errors.schoolName && <p className="text-xs text-destructive">{errors.schoolName.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Contact Person *</Label>
                <Input {...register('contactPerson')} placeholder="Full name" />
                {errors.contactPerson && <p className="text-xs text-destructive">{errors.contactPerson.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Phone *</Label>
                <Input {...register('phone')} placeholder="Phone number" />
                {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input {...register('email')} placeholder="email@school.com" type="email" />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input {...register('location')} placeholder="City, State" />
              </div>
              <div className="space-y-1.5">
                <Label>Total Students (Approx)</Label>
                <Input {...register('totalStudents')} type="number" min={1} placeholder="e.g. 500" />
              </div>
              <div className="space-y-1.5">
                <Label>Assigned To</Label>
                <Select defaultValue="none" onValueChange={(v) => setValue('assignedToId', v)}>
                  <SelectTrigger><SelectValue placeholder="Select salesperson" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea {...register('notes')} placeholder="Any notes about this referral..." rows={2} />
            </div>

            <div className="border rounded-md p-3 space-y-3 bg-muted/30">
              <p className="text-sm font-medium">Referral Incentive</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Bonus Type *</Label>
                  <Select defaultValue="FIXED" onValueChange={(v) => setValue('bonusType', v as 'FIXED' | 'PERCENTAGE')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FIXED">Fixed Amount</SelectItem>
                      <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Bonus Value * {bonusType === 'PERCENTAGE' ? '(%)' : '(₹)'}</Label>
                  <Input {...register('bonusValue')} type="number" min={0} placeholder={bonusType === 'PERCENTAGE' ? 'e.g. 5' : 'e.g. 5000'} />
                  {errors.bonusValue && <p className="text-xs text-destructive">{errors.bonusValue.message}</p>}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="bg-purple-600 hover:bg-purple-700">
                {isSubmitting ? 'Creating...' : 'Add Referral & Create Lead'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
