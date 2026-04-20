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
