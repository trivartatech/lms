import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { School, User } from '@lms/shared'

const schema = z.object({
  name: z.string().min(1, 'Required'),
  contactPerson: z.string().min(1, 'Required'),
  phone: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  location: z.string().optional(),
  totalStudents: z.coerce.number().int().min(0).optional(),
  assignedToId: z.string().optional(),
  referredBySchoolId: z.string().optional(),
  notes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  school?: School
}

export function SchoolFormDialog({ open, onClose, onSuccess, school }: Props) {
  const { data: users } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
    enabled: open,
  })

  const { data: schoolsData } = useQuery<{ data: School[] }>({
    queryKey: ['schools', 'list'],
    queryFn: () => api.get('/schools', { params: { limit: 200 } }).then((r) => r.data),
    enabled: open,
  })
  const otherSchools = schoolsData?.data?.filter((s) => s.id !== school?.id) ?? []

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: school
      ? {
          name: school.name,
          contactPerson: school.contactPerson,
          phone: school.phone,
          email: school.email ?? '',
          location: school.location ?? '',
          totalStudents: school.totalStudents,
          assignedToId: school.assignedToId?.toString() ?? '',
          referredBySchoolId: school.referredBySchoolId?.toString() ?? 'none',
          notes: school.notes ?? '',
        }
      : { referredBySchoolId: 'none' },
  })

  const onSubmit = async (data: FormData) => {
    const payload = {
      ...data,
      assignedToId: data.assignedToId ? parseInt(data.assignedToId) : undefined,
      referredBySchoolId: data.referredBySchoolId && data.referredBySchoolId !== 'none'
        ? parseInt(data.referredBySchoolId)
        : undefined,
      totalStudents: data.totalStudents || undefined,
    }
    if (school) {
      await api.put(`/schools/${school.id}`, payload)
    } else {
      await api.post('/schools', payload)
    }
    reset()
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{school ? 'Edit School' : 'Add School'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>School Name *</Label>
              <Input {...register('name')} placeholder="School name" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
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
              <Input {...register('totalStudents')} type="number" min={0} placeholder="e.g. 500" />
            </div>
            <div className="space-y-1.5">
              <Label>Assigned To</Label>
              <Select
                defaultValue={school?.assignedToId?.toString() ?? ''}
                onValueChange={(v) => setValue('assignedToId', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select salesperson" />
                </SelectTrigger>
                <SelectContent>
                  {users?.map((u) => (
                    <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Referred By</Label>
              <Select
                defaultValue={school?.referredBySchoolId?.toString() ?? 'none'}
                onValueChange={(v) => setValue('referredBySchoolId', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select referring school" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None</SelectItem>
                  {otherSchools.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea {...register('notes')} placeholder="Additional notes..." rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : school ? 'Update' : 'Add School'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
