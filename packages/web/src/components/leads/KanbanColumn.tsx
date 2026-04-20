import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Lead, PipelineStage } from '@lms/shared'
import { LeadCard } from './LeadCard'
import { cn } from '@/lib/utils'

interface Props {
  stage: PipelineStage
  label: string
  leads: Lead[]
}

const stageColors: Record<string, string> = {
  NEW: 'border-t-slate-400',
  QUALIFIED: 'border-t-blue-400',
  DEMO: 'border-t-purple-400',
  PROPOSAL: 'border-t-yellow-400',
  NEGOTIATION: 'border-t-orange-400',
  CLOSED_WON: 'border-t-green-500',
  CLOSED_LOST: 'border-t-red-500',
}

export function KanbanColumn({ stage, label, leads }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex-shrink-0 w-72 rounded-lg border-t-4 bg-muted/50 border border-border flex flex-col',
        stageColors[stage],
        isOver && 'ring-2 ring-primary',
      )}
    >
      <div className="px-3 py-2 flex items-center justify-between border-b bg-background rounded-t-sm">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">{leads.length}</span>
      </div>
      <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 p-2 flex-1 min-h-[100px]">
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}
