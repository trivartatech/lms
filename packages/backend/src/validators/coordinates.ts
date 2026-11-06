import { AppError } from '../middleware/error.middleware'

export function validateCoordinates(data: { latitude?: unknown; longitude?: unknown }) {
  const { latitude, longitude } = data
  if (latitude === undefined && longitude === undefined) return
  if (latitude === null && longitude === null) return
  if (typeof latitude !== 'number' || !Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
      typeof longitude !== 'number' || !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
    throw new AppError(400, 'Provide both valid latitude and longitude coordinates')
  }
}
