import { describe, expect, it } from 'vitest'
import { resolveDropStage, pipelineStageLabel, isPipelineStage } from '@lms/shared'

describe('pipeline drag and drop', () => {
  const leads = [{ id: 12, pipelineStage: 'PROPOSAL' }]
  it('uses the destination card’s stage rather than its numeric ID', () => {
    expect(resolveDropStage(12, leads)).toBe('PROPOSAL')
  })
  it('supports dropping on a column', () => {
    expect(resolveDropStage('QUALIFIED', leads)).toBe('QUALIFIED')
  })
  it('ignores missing and invalid targets', () => {
    expect(resolveDropStage(99, leads)).toBeNull()
    expect(resolveDropStage('invalid', leads)).toBeNull()
  })
  it.each([12, null, undefined, {}, 'invalid'])('safely labels invalid stages: %j', value => {
    expect(pipelineStageLabel(value)).toBe('Unknown stage')
    expect(isPipelineStage(value)).toBe(false)
  })
})
