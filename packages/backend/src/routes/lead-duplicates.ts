
import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { prisma } from '../config/prisma'
import { AppError } from '../middleware/error.middleware'

const inputSchema = z.object({
  schoolName: z.string().trim().min(1).max(250),
  phone: z.string().trim().max(60),
  location: z.string().trim().max(250).nullish(),
})
type Input = z.infer<typeof inputSchema>
type Candidate = { id: number | null; name: string; phone: string; location: string | null; kind: string; assignedToId: number | null }
const words = (s: string | null | undefined) => (s ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const phoneNumber = (s: string) => s.replace(/\D/g, '').replace(/^(?:91|0)(?=\d{10}$)/, '')

function duplicateReasons(input: Input, candidate: Candidate) {
  const sameName = words(input.schoolName) === words(candidate.name)
  const samePhone = phoneNumber(input.phone).length >= 7 && phoneNumber(input.phone) === phoneNumber(candidate.phone)
  const location = words(input.location)
  const sameLocation = !!location && location === words(candidate.location)
  if (!samePhone && !(sameName && (sameLocation || !location || !words(candidate.location)))) return []
  return [...(sameName ? ['School name'] : []), ...(samePhone ? ['Phone'] : []), ...(sameLocation ? ['Location'] : [])]
}

function candidateKeys(name: string, phone: string) {
  const normalizedPhone = phoneNumber(phone)
  return ['name:' + words(name), ...(normalizedPhone.length >= 7 ? ['phone:' + normalizedPhone] : [])]
}

export async function checkLeadDuplicates(req: Request, res: Response, next: NextFunction) {
  try {
    const input = z.union([inputSchema, z.array(inputSchema).min(1).max(5000)]).safeParse(req.body)
    if (!input.success) throw new AppError(400, 'Enter a school name and phone number for each lead. Imports can check up to 5,000 rows at once.')
    const [leads, schools] = await Promise.all([
      prisma.lead.findMany({ select: { id: true, schoolName: true, location: true, phone: true, assignedToId: true } }),
      prisma.school.findMany({ select: { id: true, name: true, location: true, phone: true, assignedToId: true, createdFromLeadId: true } }),
    ])
    const convertedLeadIds = new Set(schools.map(s => s.createdFromLeadId))
    const index = new Map<string, Candidate[]>()
    function add(record: Candidate) {
      for (const key of candidateKeys(record.name, record.phone)) {
        const records = index.get(key) ?? []
        records.push(record)
        index.set(key, records)
      }
    }
    schools.forEach(s => add({ ...s, kind: 'school' }))
    leads.filter(l => !convertedLeadIds.has(l.id)).forEach(l => add({ ...l, name: l.schoolName, kind: 'lead' }))

    function find(row: Input) {
      const candidates = new Set(candidateKeys(row.schoolName, row.phone).flatMap(k => index.get(k) ?? []))
      return Array.from(candidates).flatMap(record => {
        const reasons = duplicateReasons(row, record)
        if (!reasons.length) return []
        const visible = req.user.role !== 'SALES_EXECUTIVE' || record.assignedToId === req.user.id
        return [{ kind: record.kind, name: visible ? record.name : null, id: visible ? record.id : null,
          location: visible ? record.location : null, reasons }]
      })
    }

    const matches = Array.isArray(input.data) ? input.data.flatMap((row, i) => {
      const possible = find(row)
      add({ id: null, name: row.schoolName, phone: row.phone, location: row.location ?? null, kind: 'import', assignedToId: req.user.id })
      if (!possible.length) return []
      return [{ kind: 'import', name: 'Row ' + (i + 1) + ' · ' + row.schoolName, id: null, location: row.location ?? null,
        reasons: Array.from(new Set(possible.flatMap(record => [...record.reasons, ...(record.kind === 'import' ? ['Repeated in file'] : [])]))) }]
    }) : find(input.data)
    res.json({ matches: matches.slice(0, 8), total: matches.length })
  } catch (err) { next(err) }
}
