import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Link } from 'react-router-dom'
import { Phone, Mail, GitBranch } from 'lucide-react'
import type { Lead } from '@lms/shared'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Props {
  lead: Lead
  isDragging?: boolean
}

const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'info'> = {
  NEW: 'info',
  IN_PROGRESS: 'warning',
  CONVERTED: 'success',
  LOST: 'destructive',
}

export function LeadCard({ lead, isDragging }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } = useSortable({
    id: lead.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'bg-background rounded-md border p-3 cursor-grab active:cursor-grabbing shadow-sm',
        (isDragging || isSortableDragging) && 'opacity-50 shadow-lg',
      )}
    >
      <Link
        to={`/leads/${lead.id}`}
        className="block"
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-sm font-semibold line-clamp-1">{lead.schoolName}</p>
          <Badge variant={statusVariant[lead.status] ?? 'default'} className="shrink-0 text-xs">
            {lead.status.replace('_', ' ')}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mb-1">{lead.contactPerson}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Phone className="h-3 w-3" />
            {lead.phone}
          </span>
        </div>
        {lead.referredBySchool && (
          <div className="mt-2 flex items-center gap-1 text-xs text-purple-600">
            <GitBranch className="h-3 w-3" />
            <span>Ref: {lead.referredBySchool.name}</span>
          </div>
        )}
        {lead.assignedTo && (
          <p className="mt-2 text-xs text-muted-foreground">
            Assigned: {lead.assignedTo.name}
          </p>
        )}
      </Link>
    </div>
  )
}
