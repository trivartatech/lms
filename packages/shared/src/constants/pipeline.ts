export type PipelineStage =
  | 'NEW'
  | 'QUALIFIED'
  | 'DEMO'
  | 'PROPOSAL'
  | 'NEGOTIATION'
  | 'CLOSED_WON'
  | 'CLOSED_LOST'

export const PIPELINE_STAGES: PipelineStage[] = [
  'NEW',
  'QUALIFIED',
  'DEMO',
  'PROPOSAL',
  'NEGOTIATION',
  'CLOSED_WON',
  'CLOSED_LOST',
]

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  NEW: 'New',
  QUALIFIED: 'Qualified',
  DEMO: 'Demo',
  PROPOSAL: 'Proposal',
  NEGOTIATION: 'Negotiation',
  CLOSED_WON: 'Closed Won',
  CLOSED_LOST: 'Closed Lost',
}

export function isPipelineStage(value: unknown): value is PipelineStage {
  return typeof value === 'string' && PIPELINE_STAGES.includes(value as PipelineStage)
}

export function pipelineStageLabel(value: unknown): string {
  return isPipelineStage(value) ? PIPELINE_STAGE_LABELS[value] : 'Unknown stage'
}

export function resolveDropStage(target: unknown, leads: { id: number; pipelineStage: unknown }[]): PipelineStage | null {
  if (isPipelineStage(target)) return target
  const stage = leads.find((lead) => lead.id === target)?.pipelineStage
  return isPipelineStage(stage) ? stage : null
}
