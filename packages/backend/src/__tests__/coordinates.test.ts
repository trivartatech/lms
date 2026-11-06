import { describe, expect, it } from 'vitest'
import { validateCoordinates } from '../validators/coordinates'

describe('school GPS validation', () => {
  it.each([
    {}, { latitude: 0, longitude: 0 }, { latitude: 90, longitude: -180 },
    { latitude: 12.9716, longitude: 77.5946 }, { latitude: null, longitude: null },
  ])('accepts valid coordinates or an explicit removal: %j', (pin) => {
    expect(() => validateCoordinates(pin)).not.toThrow()
  })
  it.each([
    { latitude: 91, longitude: 0 }, { latitude: 0, longitude: 181 },
    { latitude: NaN, longitude: 0 }, { latitude: 0, longitude: Infinity },
    { latitude: 12 }, { longitude: 77 }, { latitude: null, longitude: 77 },
    { latitude: '12', longitude: '77' },
  ])('rejects invalid or incomplete pins: %j', (pin) => {
    expect(() => validateCoordinates(pin)).toThrow('Provide both valid latitude and longitude')
  })
})
