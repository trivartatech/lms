import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { prisma } from '../config/prisma'
import { env } from '../config/env'
import { AppError } from '../middleware/error.middleware'

/**
 * Parse a duration string like "15m", "7d", "1h" into milliseconds.
 * Used to compute refresh-token expiry for DB storage.
 */
function parseDurationMs(spec: string): number {
  const m = /^(\d+)\s*([smhd])$/.exec(spec.trim())
  if (!m) return 7 * 24 * 60 * 60 * 1000 // default 7d
  const n = Number(m[1])
  switch (m[2]) {
    case 's': return n * 1000
    case 'm': return n * 60 * 1000
    case 'h': return n * 60 * 60 * 1000
    case 'd': return n * 24 * 60 * 60 * 1000
  }
  return 7 * 24 * 60 * 60 * 1000
}

/** sha256-hex of a string — we never store raw tokens. */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function signAccess(user: { id: number; email: string; role: string }): string {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
  )
}

function signRefresh(user: { id: number; email: string; role: string }): string {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
  )
}

async function issueRefreshToken(userId: number, user: { id: number; email: string; role: string }) {
  const refreshToken = signRefresh(user)
  const tokenHash = hashToken(refreshToken)
  const expiresAt = new Date(Date.now() + parseDurationMs(env.JWT_REFRESH_EXPIRES_IN))
  const row = await prisma.refreshToken.create({
    data: { tokenHash, userId, expiresAt },
  })
  return { refreshToken, rowId: row.id }
}

export const authService = {
  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) throw new AppError(401, 'Invalid credentials')

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) throw new AppError(401, 'Invalid credentials')

    const accessToken = signAccess(user)
    const { refreshToken } = await issueRefreshToken(user.id, user)

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    }
  },

  /**
   * Refresh flow with rotation:
   *   1. Verify JWT signature + expiry
   *   2. Look up the token row by its sha256 hash
   *   3. If missing/revoked → reuse detected → revoke entire user token family
   *   4. Else revoke the used token, issue a new access + refresh pair
   */
  async refreshAccessToken(refreshToken: string) {
    let payload: { id: number; email: string; role: string }
    try {
      payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as typeof payload
    } catch {
      throw new AppError(401, 'Invalid refresh token')
    }

    const tokenHash = hashToken(refreshToken)
    const existing  = await prisma.refreshToken.findUnique({ where: { tokenHash } })

    // Reuse / theft detection — token is valid JWT but either unknown to us or already revoked.
    if (!existing || existing.revokedAt) {
      await prisma.refreshToken.updateMany({
        where: { userId: payload.id, revokedAt: null },
        data:  { revokedAt: new Date() },
      })
      throw new AppError(401, 'Refresh token reuse detected — session terminated')
    }

    if (existing.expiresAt.getTime() < Date.now()) {
      throw new AppError(401, 'Refresh token expired')
    }

    // Rotate: revoke old, issue new pair
    const user = await prisma.user.findUnique({ where: { id: payload.id } })
    if (!user) throw new AppError(401, 'User not found')

    const { refreshToken: newRefresh, rowId: newRowId } = await issueRefreshToken(user.id, {
      id: user.id, email: user.email, role: user.role,
    })
    await prisma.refreshToken.update({
      where: { id: existing.id },
      data:  { revokedAt: new Date(), replacedById: newRowId },
    })

    const accessToken = signAccess({ id: user.id, email: user.email, role: user.role })
    return { accessToken, refreshToken: newRefresh }
  },

  /** Revoke the given refresh token (logout). */
  async revokeRefreshToken(refreshToken: string | undefined) {
    if (!refreshToken) return
    const tokenHash = hashToken(refreshToken)
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data:  { revokedAt: new Date() },
    })
  },
}
