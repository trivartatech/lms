import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { GitBranch } from 'lucide-react'
import type { User } from '@lms/shared'

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
  bonusValue: z.coerce.number().min(0, 'Must be >= 0'),
})
type FormData = z.infer<typeof schema>

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  schoolId: number
  schoolName: string
}

export function AddReferralDialog({ open, onClose, onSuccess, schoolId, schoolName }: Props) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { bonusType: 'FIXED', bonusValue: 0 },
  })

  const bonusType = watch('bonusType')

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
    enabled: open,
  })

  const onSubmit = async (data: FormData) => {
    await api.post(`/schools/${schoolId}/referrals`, {
      ...data,
      totalStudents: data.totalStudents ? Number(data.totalStudents) : undefined,
      assignedToId: data.assignedToId && data.assignedToId !== 'none' ? parseInt(data.assignedToId) : undefined,
    })
    reset()
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-purple-600" />
            Add Referral from {schoolName}
          </DialogTitle>
          <DialogDescription>
            Fill in the details of the new school. A lead will be automatically created and linked to {schoolName}.
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
                <Select
                  defaultValue="FIXED"
                  onValueChange={(v) => setValue('bonusType', v as 'FIXED' | 'PERCENTAGE')}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIXED">Fixed Amount</SelectItem>
                    <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Bonus Value * {bonusType === 'PERCENTAGE' ? '(%)' : '(₹)'}</Label>
                <Input
                  {...register('bonusValue')}
                  type="number"
                  min={0}
                  placeholder={bonusType === 'PERCENTAGE' ? 'e.g. 5' : 'e.g. 5000'}
                />
                {errors.bonusValue && <p className="text-xs text-destructive">{errors.bonusValue.message}</p>}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="bg-purple-600 hover:bg-purple-700">
              {isSubmitting ? 'Creating...' : 'Add Referral & Create Lead'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
