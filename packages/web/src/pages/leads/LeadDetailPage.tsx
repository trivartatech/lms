import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { ArrowLeft, GitBranch, Edit, CheckCircle, Clock, Phone, Mail, MapPin, User, Users, MessageCircle, PhoneCall, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LeadFormDialog } from '@/components/leads/LeadFormDialog'
import { TaskFormDialog } from '@/components/tasks/TaskFormDialog'
import { QuotationsTab } from '@/components/shared/QuotationsTab'
import { ContactsTab } from '@/components/shared/ContactsTab'
import { AddOnsTab } from '@/components/schools/tabs/AddOnsTab'
import { LeadReferralsTab } from '@/components/leads/LeadReferralsTab'
import { Skeleton } from '@/components/ui/skeleton'
import type { Lead, TimelineEvent, Task } from '@lms/shared'
import { formatDate, formatDateTime, waLink } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'

const statusVariant: Record<string, any> = {
  NEW: 'info', IN_PROGRESS: 'warning', CONVERTED: 'success', LOST: 'destructive',
}

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const [showEdit, setShowEdit] = useState(false)
  const [showTaskForm, setShowTaskForm] = useState(false)

  const { data: lead, isLoading } = useQuery<Lead>({
    queryKey: ['leads', id],
    queryFn: () => api.get(`/leads/${id}`).then((r) => r.data),
  })

  const { data: timeline } = useQuery<TimelineEvent[]>({
    queryKey: ['leads', id, 'timeline'],
    queryFn: () => api.get(`/leads/${id}/timeline`).then((r) => r.data),
  })

  const { data: tasks } = useQuery<Task[]>({
    queryKey: ['tasks', { leadId: id }],
    queryFn: () => api.get('/tasks', { params: { leadId: id } }).then((r) => r.data),
  })

  const convertMutation = useMutation({
    mutationFn: () => api.post(`/leads/${id}/convert`),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['schools'] })
      navigate(`/schools/${res.data.id}`)
    },
  })

  if (isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-48" />
      <div className="grid grid-cols-2 gap-4 mt-4">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    </div>
  )
  if (!lead) return <div className="py-12 text-center text-muted-foreground">Lead not found</div>

  const canConvert = (user?.role === 'ADMIN' || user?.role === 'SALES_MANAGER') && lead.status !== 'CONVERTED'

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/leads')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{lead.schoolName}</h1>
            <Badge variant={statusVariant[lead.status]}>{lead.status.replace('_', ' ')}</Badge>
          </div>
          <p className="text-muted-foreground text-sm">{lead.pipelineStage.replace('_', ' ')}</p>
        </div>
        <div className="flex gap-2">
          {canConvert && (
            <Button
              variant="outline"
              size="sm"
              className="text-green-600 border-green-200 hover:bg-green-50"
              onClick={() => convertMutation.mutate()}
              disabled={convertMutation.isPending}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              {convertMutation.isPending ? 'Converting...' : 'Convert to School'}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
            <Edit className="h-4 w-4 mr-1" /> Edit
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="quotations">Quotations</TabsTrigger>
          <TabsTrigger value="addons">Add-Ons</TabsTrigger>
          <TabsTrigger value="timeline">Timeline ({timeline?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({tasks?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="referrals" className="text-purple-700 data-[state=active]:bg-purple-50">Referrals</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Contact Information</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4" /><span>{lead.contactPerson}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span>{lead.phone}</span>
                  <a href={`tel:+91${lead.phone.replace(/\D/g, '')}`} title="Call" className="text-blue-600 hover:opacity-70">
                    <PhoneCall className="h-4 w-4" />
                  </a>
                  <a
                    href={waLink(lead.phone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="WhatsApp"
                    className="text-green-600 hover:opacity-70"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </a>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" /><span>{lead.email}</span>
                </div>
                {lead.location && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" /><span>{lead.location}</span>
                  </div>
                )}
                {lead.totalStudents != null && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4" /><span>{lead.totalStudents.toLocaleString()} students (approx)</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Lead Details</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Assigned To</span>
                  <span>{lead.assignedTo?.name ?? 'Unassigned'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span>{formatDate(lead.createdAt)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <GitBranch className="h-3.5 w-3.5" /> Referred By
                  </span>
                  <div className="flex items-center gap-1.5">
                    {lead.referredBySchool ? (
                      <Link to={`/schools/${lead.referredBySchoolId}`} className="text-primary hover:underline font-medium">
                        {lead.referredBySchool.name}
                      </Link>
                    ) : lead.referredByLead ? (
                      <Link to={`/leads/${lead.referredByLeadId}`} className="text-primary hover:underline font-medium">
                        {lead.referredByLead.schoolName}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                    <button
                      onClick={() => setShowEdit(true)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      title="Edit referred by"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          {lead.notes && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{lead.notes}</p></CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="contacts" className="mt-4">
          <ContactsTab leadId={parseInt(id!)} />
        </TabsContent>

        <TabsContent value="quotations" className="mt-4">
          <QuotationsTab leadId={parseInt(id!)} totalStudents={lead.totalStudents ?? undefined} />
        </TabsContent>

        <TabsContent value="addons" className="mt-4">
          <AddOnsTab leadId={parseInt(id!)} />
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              {timeline?.length ? (
                <div className="space-y-3">
                  {timeline.map((event) => (
                    <div key={event.id} className="flex gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        <div className="h-2 w-2 rounded-full bg-primary mt-1.5" />
                      </div>
                      <div className="flex-1 pb-3 border-b last:border-0">
                        <p className="text-sm">{event.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDateTime(event.createdAt)}
                          {event.createdBy && ` · ${event.createdBy.name}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-6 text-muted-foreground text-sm">No timeline events yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="referrals" className="mt-4">
          <LeadReferralsTab leadId={parseInt(id!)} leadName={lead.schoolName} />
        </TabsContent>

        <TabsContent value="tasks" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowTaskForm(true)}>
              <Clock className="h-4 w-4 mr-1" /> Add Task
            </Button>
          </div>
          {tasks?.length ? (
            tasks.map((task) => (
              <Card key={task.id}>
                <CardContent className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {task.type} · Due {formatDate(task.dueDate)}
                      {task.assignedTo && ` · ${task.assignedTo.name}`}
                    </p>
                  </div>
                  <Badge variant={task.status === 'COMPLETED' ? 'success' : task.status === 'CANCELLED' ? 'destructive' : 'warning'}>
                    {task.status}
                  </Badge>
                </CardContent>
              </Card>
            ))
          ) : (
            <p className="text-center py-6 text-muted-foreground text-sm">No tasks yet</p>
          )}
        </TabsContent>
      </Tabs>

      <LeadFormDialog
        open={showEdit}
        onClose={() => setShowEdit(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['leads', id] })
          setShowEdit(false)
        }}
        lead={lead}
      />

      <TaskFormDialog
        open={showTaskForm}
        onClose={() => setShowTaskForm(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['tasks', { leadId: id }] })
          setShowTaskForm(false)
        }}
        defaultLeadId={parseInt(id!)}
      />
    </div>
  )
}
