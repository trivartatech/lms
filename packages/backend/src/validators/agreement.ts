import { AppError } from '../middleware/error.middleware'

export function validateAgreement(data: { startDate: string | Date; endDate: string | Date; value: unknown; advancePayment?: unknown; totalInstalments?: unknown }) {
  const start = new Date(data.startDate).getTime()
  const end = new Date(data.endDate).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) throw new AppError(400, 'Agreement end date must be on or after its start date')
  const value = Number(data.value)
  const advance = Number(data.advancePayment ?? 0)
  const instalments = Number(data.totalInstalments ?? 0)
  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(advance) || advance < 0 || advance > value || !Number.isInteger(instalments) || instalments < 0) {
    throw new AppError(400, 'Invalid agreement value, advance payment, or instalment count')
  }
}
