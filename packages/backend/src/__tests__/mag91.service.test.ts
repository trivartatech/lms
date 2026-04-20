import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The service reads env at call-time via the imported `env` module. We mock
// that module and swap values per-test.
vi.mock('../config/env', () => ({
  env: {
    MAG91_API_KEY:   '',
    MAG91_SENDER_ID: '',
    MAG91_BASE_URL:  'https://api.mag91.test',
  },
}))

import { env } from '../config/env'
import { mag91Service } from '../services/mag91.service'

describe('mag91Service', () => {
  const fetchSpy = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchSpy)
    fetchSpy.mockReset()
    ;(env as any).MAG91_API_KEY   = ''
    ;(env as any).MAG91_SENDER_ID = ''
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('no-ops sendText when not configured', async () => {
    const result = await mag91Service.sendText({ phone: '91999', message: 'hi' })
    expect(result).toEqual({ skipped: true })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('no-ops sendTemplate when not configured', async () => {
    const result = await mag91Service.sendTemplate({ phone: '91999', templateName: 'welcome' })
    expect(result).toEqual({ skipped: true })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('POSTs to /v1/messages/text with bearer auth when configured', async () => {
    ;(env as any).MAG91_API_KEY   = 'secret-key'
    ;(env as any).MAG91_SENDER_ID = 'SENDERID'
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: 'msg-1' }),
    })

    const result = await mag91Service.sendText({ phone: '919876543210', message: 'hello' })

    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://api.mag91.test/v1/messages/text')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer secret-key')
    expect(JSON.parse(init.body)).toEqual({
      sender: 'SENDERID',
      recipient: '919876543210',
      message: 'hello',
    })
    expect(result).toEqual({ id: 'msg-1' })
  })

  it('throws when Mag91 responds non-2xx', async () => {
    ;(env as any).MAG91_API_KEY   = 'secret-key'
    ;(env as any).MAG91_SENDER_ID = 'SENDERID'
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 422,
      text: async () => 'Invalid recipient',
    })

    await expect(
      mag91Service.sendText({ phone: 'bad', message: 'x' }),
    ).rejects.toThrow(/422.*Invalid recipient/)
  })
})
