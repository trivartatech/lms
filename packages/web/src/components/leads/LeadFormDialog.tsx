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
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { User, Lead, School, PaginatedLeads } from '@lms/shared'

const schema = z.object({
  schoolName: z.string().min(1, 'Required'),
  contactPerson: z.string().min(1, 'Required'),
  phone: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  location: z.string().optional(),
  notes: z.string().optional(),
  assignedToId: z.string().optional(),
  totalStudents: z.coerce.number().int().min(0).optional(),
  // Combined referrer value: "school:1" | "lead:5" | ""
  referredBy: z.string().optional(),
})
type FormData = z.infer<typeof schema>

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  lead?: Lead
}

function getReferredByDefault(lead?: Lead): string {
  if (!lead) return ''
  if (lead.referredBySchoolId) return `school:${lead.referredBySchoolId}`
  if (lead.referredByLeadId) return `lead:${lead.referredByLeadId}`
  return ''
}

export function LeadFormDialog({ open, onClose, onSuccess, lead }: Props) {
  const { data: users } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
  })

  const { data: schoolsData } = useQuery<{ data: School[] }>({
    queryKey: ['schools', 'list'],
    queryFn: () => api.get('/schools', { params: { limit: 200 } }).then((r) => r.data),
  })

  const { data: pipelineLeads } = useQuery<PaginatedLeads>({
    queryKey: ['leads', 'pipeline'],
    queryFn: () => api.get('/leads', { params: { limit: 200, status: 'NEW' } }).then((r) => r.data),
  })

  // Also fetch IN_PROGRESS leads for pipeline referrers
  const { data: inProgressLeads } = useQuery<PaginatedLeads>({
    queryKey: ['leads', 'pipeline-inprogress'],
    queryFn: () => api.get('/leads', { params: { limit: 200, status: 'IN_PROGRESS' } }).then((r) => r.data),
  })

  const allPipelineLeads = [
    ...(pipelineLeads?.data ?? []),
    ...(inProgressLeads?.data ?? []),
  ].filter((l) => !lead || l.id !== lead.id) // exclude self when editing

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: lead
      ? {
          schoolName: lead.schoolName,
          contactPerson: lead.contactPerson,
          phone: lead.phone,
          email: lead.email,
          location: lead.location ?? '',
          notes: lead.notes ?? '',
          assignedToId: lead.assignedToId?.toString() ?? '',
          totalStudents: lead.totalStudents,
          referredBy: getReferredByDefault(lead),
        }
      : {},
  })

  const onSubmit = async (data: FormData) => {
    let referredBySchoolId: number | undefined
    let referredByLeadId: number | undefined

    if (data.referredBy?.startsWith('school:')) {
      referredBySchoolId = parseInt(data.referredBy.split(':')[1])
    } else if (data.referredBy?.startsWith('lead:')) {
      referredByLeadId = parseInt(data.referredBy.split(':')[1])
    }

    const payload = {
      ...data,
      referredBy: undefined,
      assignedToId: data.assignedToId ? parseInt(data.assignedToId) : undefined,
      totalStudents: data.totalStudents || undefined,
      referredBySchoolId,
      referredByLeadId,
    }
    if (lead) {
      await api.put(`/leads/${lead.id}`, payload)
    } else {
      await api.post('/leads', payload)
    }
    reset()
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{lead ? 'Edit Lead' : 'New Lead'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>School Name *</Label>
              <Input {...register('schoolName')} placeholder="School name" />
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
              <Input {...register('totalStudents')} type="number" min={0} placeholder="e.g. 500" />
            </div>
            <div className="space-y-1.5">
              <Label>Assigned To</Label>
              <Select
                defaultValue={lead?.assignedToId?.toString()}
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
            <div className="col-span-2 space-y-1.5">
              <Label>Referred By</Label>
              <Select
                defaultValue={getReferredByDefault(lead)}
                onValueChange={(v) => setValue('referredBy', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select school or pipeline lead (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {(schoolsData?.data?.length ?? 0) > 0 && (
                    <SelectGroup>
                      <SelectLabel className="text-xs text-muted-foreground">Client Schools</SelectLabel>
                      {schoolsData?.data?.map((s) => (
                        <SelectItem key={`school:${s.id}`} value={`school:${s.id}`}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {allPipelineLeads.length > 0 && (
                    <SelectGroup>
                      <SelectLabel className="text-xs text-muted-foreground">Pipeline Leads</SelectLabel>
                      {allPipelineLeads.map((l) => (
                        <SelectItem key={`lead:${l.id}`} value={`lead:${l.id}`}>
                          {l.schoolName} <span className="text-muted-foreground">({l.pipelineStage.replace('_', ' ')})</span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
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
              {isSubmitting ? 'Saving...' : lead ? 'Update Lead' : 'Create Lead'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
