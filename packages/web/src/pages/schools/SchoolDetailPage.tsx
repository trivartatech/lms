import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { ArrowLeft, Edit, School as SchoolIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { OverviewTab } from '@/components/schools/tabs/OverviewTab'
import { AgreementsTab } from '@/components/schools/tabs/AgreementsTab'
import { AddOnsTab } from '@/components/schools/tabs/AddOnsTab'
import { ReferralsTab } from '@/components/schools/tabs/ReferralsTab'
import { TasksTab } from '@/components/schools/tabs/TasksTab'
import { QuotationsTab } from '@/components/shared/QuotationsTab'
import { ContactsTab } from '@/components/shared/ContactsTab'
import { SchoolFormDialog } from '@/components/schools/SchoolFormDialog'
import { Skeleton } from '@/components/ui/skeleton'
import type { School } from '@lms/shared'

export function SchoolDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showEdit, setShowEdit] = useState(false)

  const { data: school, isLoading } = useQuery<School>({
    queryKey: ['schools', id],
    queryFn: () => api.get(`/schools/${id}`).then((r) => r.data),
  })

  if (isLoading) return (
    <div className="space-y-4 max-w-5xl">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-48" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    </div>
  )
  if (!school) return <div className="py-12 text-center text-muted-foreground">School not found</div>

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/schools')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3 flex-1">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <SchoolIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{school.name}</h1>
            <p className="text-muted-foreground text-sm">{school.location}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
          <Edit className="h-4 w-4 mr-1" /> Edit
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="grid grid-cols-7 w-full max-w-3xl">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="agreements">Agreements</TabsTrigger>
          <TabsTrigger value="quotations">Quotations</TabsTrigger>
          <TabsTrigger value="addons">Add-Ons</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="referrals" className="text-purple-700 data-[state=active]:bg-purple-50">
            Referrals
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab school={school} onEdit={() => setShowEdit(true)} />
        </TabsContent>

        <TabsContent value="contacts" className="mt-4">
          <ContactsTab schoolId={school.id} />
        </TabsContent>

        <TabsContent value="agreements" className="mt-4">
          <AgreementsTab schoolId={school.id} />
        </TabsContent>

        <TabsContent value="quotations" className="mt-4">
          <QuotationsTab schoolId={school.id} totalStudents={school.totalStudents ?? undefined} />
        </TabsContent>

        <TabsContent value="addons" className="mt-4">
          <AddOnsTab schoolId={school.id} />
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          <TasksTab schoolId={school.id} />
        </TabsContent>

        <TabsContent value="referrals" className="mt-4">
          <ReferralsTab schoolId={school.id} schoolName={school.name} />
        </TabsContent>
      </Tabs>

      <SchoolFormDialog
        open={showEdit}
        onClose={() => setShowEdit(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['schools', id] })
          setShowEdit(false)
        }}
        school={school}
      />
    </div>
  )
}
