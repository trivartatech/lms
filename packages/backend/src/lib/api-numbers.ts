import { Decimal } from '@prisma/client/runtime/library'

// Shared API contracts declare money as numbers; Prisma serializes Decimal as text.
export function apiNumbers(value: any): any {
  if (Decimal.isDecimal(value)) return value.toNumber()
  if (value instanceof Date || value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(apiNumbers)
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, apiNumbers(item)]))
}
