import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Activity, User, School, Kanban, ChevronLeft, ChevronRight } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'

interface TimelineEvent {
  id: number
  eventType: string
  description: string
  createdAt: string
  lead?: { id: number; schoolName: string } | null
  school?: { id: number; name: string } | null
  createdBy?: { id: number; name: string } | null
}

interface ActivityFeed {
  data: TimelineEvent[]
  total: number
  page: number
  limit: number
}

const EVENT_COLORS: Record<string, string> = {
  LEAD_CREATED: 'bg-blue-500',
  LEAD_UPDATED: 'bg-slate-400',
  LEAD_CONVERTED: 'bg-green-500',
  STAGE_CHANGED: 'bg-purple-500',
  REFERRAL_CREATED: 'bg-orange-500',
  NOTE_ADDED: 'bg-yellow-500',
  TASK_COMPLETED: 'bg-teal-500',
}

function eventDot(type: string) {
  return EVENT_COLORS[type] ?? 'bg-muted-foreground'
}

export function ActivityPage() {
  const [page, setPage] = useState(1)
  const limit = 30

  const { data, isLoading } = useQuery<ActivityFeed>({
    queryKey: ['activity', page],
    queryFn: () => api.get('/activity', { params: { page, limit } }).then((r) => r.data),
  })

  const events = data?.data ?? []
  const totalPages = data ? Math.ceil(data.total / limit) : 1

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Activity Log</h1>
        <p className="text-muted-foreground text-sm">
          {data?.total ?? 0} total events — all changes across leads and schools
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading activity...</div>
      ) : events.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No activity recorded yet.</div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

          <div className="space-y-0">
            {events.map((event, idx) => (
              <div key={event.id} className="relative flex gap-4 pl-10 pb-6">
                {/* Dot */}
                <span
                  className={`absolute left-2.5 mt-1.5 h-3 w-3 rounded-full border-2 border-background ${eventDot(event.eventType)}`}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm">{event.description}</p>
                    <time className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                      {new Date(event.createdAt).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    {event.createdBy && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {event.createdBy.name}
                      </span>
                    )}
                    {event.lead && (
                      <Link
                        to={`/leads/${event.lead.id}`}
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        <Kanban className="h-3 w-3" />
                        {event.lead.schoolName}
                      </Link>
                    )}
                    {event.school && (
                      <Link
                        to={`/schools/${event.school.id}`}
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        <School className="h-3 w-3" />
                        {event.school.name}
                      </Link>
                    )}
                    <span className="ml-auto text-[10px] uppercase tracking-wide opacity-60">
                      {event.eventType.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={page === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
