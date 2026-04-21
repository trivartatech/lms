import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { toast } from '@/lib/toast-store'
import type { Task } from '@lms/shared'

interface Props {
  task: Task | null
  onClose: () => void
}

/** Seed value for the date input — trims an ISO DateTime down to YYYY-MM-DD. */
function toDateInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${da}`
}

export function RescheduleTaskDialog({ task, onClose }: Props) {
  const queryClient = useQueryClient()
  const [newDate, setNewDate] = useState('')

  const seeded = toDateInput(task?.dueDate)

  // Re-seed whenever a different task is targeted, clear on close.
  useEffect(() => {
    if (task) setNewDate(seeded)
    else setNewDate('')
  }, [task?.id, seeded])

  const mutation = useMutation({
    mutationFn: (payload: { id: number; dueDate: string }) =>
      api.put(`/tasks/${payload.id}`, { dueDate: payload.dueDate }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      toast.success('Task rescheduled')
      onClose()
    },
    onError: () => {
      toast.error('Failed to reschedule task')
    },
  })

  const handleSave = () => {
    if (!task || !newDate) return
    if (newDate === seeded) {
      onClose()
      return
    }
    mutation.mutate({ id: task.id, dueDate: newDate })
  }

  const open = task !== null

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reschedule task</DialogTitle>
          {task && (
            <DialogDescription className="space-y-0.5">
              <span className="block font-medium text-foreground">{task.title}</span>
              <span className="block">Currently due {formatDate(task.dueDate)}</span>
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="reschedule-date">New due date</Label>
          <Input
            id="reschedule-date"
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={mutation.isPending || !newDate}
          >
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
