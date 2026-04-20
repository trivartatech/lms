import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { TaskFormDialog } from '@/components/tasks/TaskFormDialog'
import type { Task } from '@lms/shared'
import { formatDate } from '@/lib/utils'

interface Props {
  schoolId: number
}

export function TasksTab({ schoolId }: Props) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)

  const { data: tasks } = useQuery<Task[]>({
    queryKey: ['tasks', { schoolId }],
    queryFn: () => api.get('/tasks', { params: { schoolId } }).then((r) => r.data),
  })

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowForm(true)}>
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

      <TaskFormDialog
        open={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['tasks', { schoolId }] })
          setShowForm(false)
        }}
        defaultSchoolId={schoolId}
      />
    </div>
  )
}
