import { z } from 'zod'

// ── Shared primitives ────────────────────────────────────────────────────────
const intFromString = z
  .string()
  .optional()
  .transform((v) => (v == null || v === '' ? undefined : Number(v)))
  .refine((v) => v === undefined || Number.isFinite(v), { message: 'Must be an integer' })

const intWithDefault = (defaultValue: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v == null || v === '' ? defaultValue : Number(v)))
    .refine((v) => Number.isFinite(v) && v > 0, { message: 'Must be a positive integer' })

const nonEmpty = z.string().min(1).optional()

// ── Leads list ───────────────────────────────────────────────────────────────
export const leadListQuerySchema = z.object({
  stage:      nonEmpty,
  status:     nonEmpty,
  assignedTo: intFromString,
  search:     nonEmpty,
  page:       intWithDefault(1),
  limit:      intWithDefault(20),
})

// ── Schools list ─────────────────────────────────────────────────────────────
export const schoolListQuerySchema = z.object({
  search:     nonEmpty,
  assignedTo: intFromString,
  page:       intWithDefault(1),
  limit:      intWithDefault(50),
})

// ── Tasks list ───────────────────────────────────────────────────────────────
export const taskListQuerySchema = z.object({
  status:     nonEmpty,
  type:       nonEmpty,
  assignedTo: intFromString,
  leadId:     intFromString,
  schoolId:   intFromString,
  from:       nonEmpty, // ISO date string
  to:         nonEmpty,
  page:       intWithDefault(1),
  limit:      intWithDefault(50),
})

// ── Quotations list ──────────────────────────────────────────────────────────
export const quotationListQuerySchema = z.object({
  status:   nonEmpty,
  leadId:   intFromString,
  schoolId: intFromString,
  page:     intWithDefault(1),
  limit:    intWithDefault(50),
})

// ── Agreements list ──────────────────────────────────────────────────────────
export const agreementListQuerySchema = z.object({
  status:   nonEmpty,
  schoolId: intFromString,
  page:     intWithDefault(1),
  limit:    intWithDefault(50),
})

// ── Activity feed ────────────────────────────────────────────────────────────
export const activityQuerySchema = z.object({
  page:  intWithDefault(1),
  limit: intWithDefault(30),
})

// ── Reports (date range) ─────────────────────────────────────────────────────
export const reportsQuerySchema = z.object({
  from: nonEmpty,
  to:   nonEmpty,
})

// ── Numeric :id param ────────────────────────────────────────────────────────
export const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Must be numeric'),
})
