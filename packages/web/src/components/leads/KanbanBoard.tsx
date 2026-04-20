import { useState } from 'react'
import { DndContext, DragEndEvent, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS, type PipelineStage } from '@lms/shared'
import type { Lead } from '@lms/shared'
import { KanbanColumn } from './KanbanColumn'
import { LeadCard } from './LeadCard'
import { toast } from '@/lib/toast-store'

interface Props {
  leads: Lead[]
}

/** Shape of what the leads list query caches — same endpoint as /leads returns. */
type LeadsListCache = { data: Lead[]; total: number; page: number; limit: number } | Lead[]

export function KanbanBoard({ leads }: Props) {
  const queryClient = useQueryClient()
  const [activeId, setActiveId] = useState<number | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const moveMutation = useMutation({
    mutationFn: ({ id, stage }: { id: number; stage: PipelineStage }) =>
      api.put(`/leads/${id}`, { pipelineStage: stage }),
    // Optimistic update: mutate the cache immediately, snapshot for rollback.
    onMutate: async ({ id, stage }) => {
      await queryClient.cancelQueries({ queryKey: ['leads'] })
      const snapshots = queryClient.getQueriesData<LeadsListCache>({ queryKey: ['leads'] })
      queryClient.setQueriesData<LeadsListCache>({ queryKey: ['leads'] }, (old) => {
        if (!old) return old
        const mapLead = (l: Lead) => (l.id === id ? { ...l, pipelineStage: stage } : l)
        if (Array.isArray(old)) return old.map(mapLead)
        return { ...old, data: old.data.map(mapLead) }
      })
      return { snapshots }
    },
    onError: (_err, _vars, context) => {
      // Roll back every snapshot we captured.
      context?.snapshots.forEach(([key, data]) => queryClient.setQueryData(key, data))
      toast.error('Failed to move lead — reverted.')
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
    meta: { silent: true },
  })

  const leadsByStage = PIPELINE_STAGES.reduce<Record<string, Lead[]>>((acc, stage) => {
    acc[stage] = leads.filter((l) => l.pipelineStage === stage)
    return acc
  }, {})

  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    if (!over) return
    const newStage = over.id as PipelineStage
    const lead = leads.find((l) => l.id === active.id)
    if (!lead || lead.pipelineStage === newStage) return
    moveMutation.mutate({ id: lead.id, stage: newStage })
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={({ active }) => setActiveId(active.id as number)}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {PIPELINE_STAGES.map((stage) => (
          <KanbanColumn
            key={stage}
            stage={stage}
            label={PIPELINE_STAGE_LABELS[stage]}
            leads={leadsByStage[stage] ?? []}
          />
        ))}
      </div>
      <DragOverlay>
        {activeLead ? <LeadCard lead={activeLead} isDragging /> : null}
      </DragOverlay>
    </DndContext>
  )
}
