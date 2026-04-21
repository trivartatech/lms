import { Request, Response, NextFunction } from 'express'
import { prisma } from '../config/prisma'

/**
 * Idempotency middleware.
 *
 * Offline-capable mobile clients queue mutations to AsyncStorage while offline,
 * then replay them on reconnect. A flaky network can cause a request to reach
 * the server, commit, and then have its response dropped — the client then
 * replays the same request and creates a duplicate record.
 *
 * To prevent that, clients attach an `Idempotency-Key` header (a UUID generated
 * at enqueue time). On first request we process normally then cache the
 * response. On replay within the TTL window we short-circuit and return the
 * cached response without touching the DB a second time.
 *
 * Scope: mutating methods only (POST/PUT/PATCH/DELETE). GETs are naturally
 * idempotent and don't need this.
 *
 * Scope: requires `authenticate` middleware to have populated `req.user` so we
 * can scope keys per-user and prevent cross-tenant collisions.
 *
 * TTL: 24 hours. Longer than any realistic queue flush but short enough that
 * the `idempotency_keys` table doesn't grow unbounded. A separate cleanup job
 * or cron can hard-delete expired rows; reads below also skip expired rows.
 */

const TTL_MS = 24 * 60 * 60 * 1000
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export async function idempotency(req: Request, res: Response, next: NextFunction) {
  // Only apply to mutating requests — reads are naturally safe to replay.
  if (!MUTATING_METHODS.has(req.method)) return next()

  const rawKey = req.header('Idempotency-Key') ?? req.header('idempotency-key')
  if (!rawKey) return next()

  // Basic sanity check — reject obviously bogus keys without touching the DB.
  const key = rawKey.trim()
  if (key.length < 8 || key.length > 128) return next()

  // Must be authenticated for us to scope the key. If auth hasn't run yet we
  // just let the request through — the route's own auth middleware will reject
  // it and we avoid an unauthenticated DB probe.
  if (!req.user) return next()

  const userId = req.user.id

  try {
    const existing = await prisma.idempotencyKey.findUnique({
      where: { userId_key: { userId, key } },
    })

    if (existing && existing.expiresAt.getTime() > Date.now()) {
      // Replay — return the cached response verbatim. Tag the response so
      // clients (and tests) can see the short-circuit happened.
      res.setHeader('Idempotent-Replay', 'true')
      res.status(existing.status)
      try {
        res.json(JSON.parse(existing.response))
      } catch {
        // Older row with non-JSON body — fall back to raw send.
        res.send(existing.response)
      }
      return
    }

    // Expired — clear it so we can cache the fresh response below without
    // tripping the unique constraint.
    if (existing) {
      await prisma.idempotencyKey
        .delete({ where: { userId_key: { userId, key } } })
        .catch(() => {})
    }
  } catch (err) {
    // DB lookup failed — don't let idempotency bookkeeping break the request.
    // Log and continue; worst case is a replay creates a duplicate, same as today.
    console.error('[idempotency] lookup failed:', err)
    return next()
  }

  // Monkey-patch res.json so we capture the response body after the route handler
  // runs successfully. We only cache 2xx responses — errors may be transient
  // and should be allowed to retry.
  const originalJson = res.json.bind(res)
  res.json = (body: unknown) => {
    // Best-effort write; never block the response on cache persistence.
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const responseJson = safeStringify(body)
      if (responseJson !== null) {
        prisma.idempotencyKey
          .create({
            data: {
              userId,
              key,
              method: req.method,
              path: req.originalUrl.split('?')[0],
              status: res.statusCode,
              response: responseJson,
              expiresAt: new Date(Date.now() + TTL_MS),
            },
          })
          .catch((err) => {
            // Unique-constraint collision (another replay raced through) or DB
            // hiccup — just log. The client already got a correct response.
            if (!String(err?.code).includes('P2002')) {
              console.error('[idempotency] cache write failed:', err)
            }
          })
      }
    }
    return originalJson(body)
  }

  return next()
}

function safeStringify(value: unknown): string | null {
  try {
    return JSON.stringify(value)
  } catch {
    return null
  }
}
