import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, CheckCircle, Phone, Users, Bell } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { TaskFormDialog } from '@/components/tasks/TaskFormDialog'
import { TableSkeleton } from '@/components/ui/skeleton'
import type { Task } from '@lms/shared'
import { formatDate } from '@/lib/utils'

const statusVariant: Record<string, any> = {
  PENDING: 'warning', COMPLETED: 'success', CANCELLED: 'destructive',
}

const typeIcon: Record<string, any> = {
  CALL: Phone, MEETING: Users, REMINDER: Bell,
}

export function TasksPage() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)

  const { data: tasks, isLoading } = useQuery<Task[]>({
    queryKey: ['tasks'],
    queryFn: () => api.get('/tasks').then((r) => r.data),
  })

  const completeMutation = useMutation({
    mutationFn: (id: number) => api.put(`/tasks/${id}`, { status: 'COMPLETED' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tasks & Follow-ups</h1>
          <p className="text-muted-foreground text-sm">{tasks?.length ?? 0} tasks</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Task
        </Button>
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} cols={3} />
      ) : (
        <div className="space-y-2">
          {tasks?.map((task) => {
            const Icon = typeIcon[task.type] ?? Bell
            return (
              <Card key={task.id} className={task.status === 'COMPLETED' ? 'opacity-60' : ''}>
                <CardContent className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className={`text-sm font-medium ${task.status === 'COMPLETED' ? 'line-through' : ''}`}>
                        {task.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Due {formatDate(task.dueDate)}
                        {task.assignedTo && ` · ${task.assignedTo.name}`}
                        {task.lead && ` · Lead: ${task.lead.schoolName}`}
                        {task.school && ` · School: ${task.school.name}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant[task.status]}>{task.status}</Badge>
                    {task.status === 'PENDING' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-green-600 h-7 px-2"
                        onClick={() => completeMutation.mutate(task.id)}
                        disabled={completeMutation.isPending}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
          {(!tasks || tasks.length === 0) && (
            <div className="text-center py-12 text-muted-foreground border rounded-md bg-muted/20">
              No tasks yet
            </div>
          )}
        </div>
      )}

      <TaskFormDialog
        open={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['tasks'] })
          setShowForm(false)
        }}
      />
    </div>
  )
}
