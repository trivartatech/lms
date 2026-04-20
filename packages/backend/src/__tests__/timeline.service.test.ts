import { describe, it, expect } from 'vitest'
import { computeDiff } from '../services/timeline.service'

describe('computeDiff', () => {
  it('returns empty diff for unchanged fields', () => {
    const prev = { name: 'Acme', phone: '+91 12345' }
    const next = { name: 'Acme', phone: '+91 12345' }
    expect(computeDiff(prev, next)).toEqual({})
  })

  it('captures changed string fields with before/after', () => {
    const prev = { name: 'Acme',  phone: '+91 1' }
    const next = { name: 'AcmeX', phone: '+91 1' }
    expect(computeDiff(prev, next)).toEqual({
      name: { before: 'Acme', after: 'AcmeX' },
    })
  })

  it('treats null and undefined as equal', () => {
    const prev = { email: null }
    const next = { email: undefined }
    expect(computeDiff(prev, next)).toEqual({})
  })

  it('normalises Date values via toISOString before comparing', () => {
    const when = new Date('2026-01-01T00:00:00.000Z')
    const prev = { dueDate: when }
    const next = { dueDate: new Date('2026-01-01T00:00:00.000Z') }
    expect(computeDiff(prev, next)).toEqual({})
  })

  it('detects Date changes', () => {
    const prev = { dueDate: new Date('2026-01-01T00:00:00.000Z') }
    const next = { dueDate: new Date('2026-01-02T00:00:00.000Z') }
    const diff = computeDiff(prev, next)
    expect(Object.keys(diff)).toEqual(['dueDate'])
  })

  it('only inspects keys present in next (the submitted patch)', () => {
    // Full prev row has extra columns; they should be ignored.
    const prev = { name: 'A', internalFlag: true, createdAt: new Date() }
    const next = { name: 'B' }
    expect(computeDiff(prev, next)).toEqual({
      name: { before: 'A', after: 'B' },
    })
  })
})
